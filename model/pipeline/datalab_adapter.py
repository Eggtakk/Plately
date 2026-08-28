"""데이터랩 "외국인 지역별 방문자 수" export → gap_index 수요 입력 DataFrame.

CSV 컬럼: 광역지자체명, 기초지자체명, 광역지자체 방문자 수, 광역지자체 방문자 비율,
          기초지자체 방문자 수, 기초지자체 방문자 비율

geojson feature = {code: "11030", name: "용산구"} (kostat-2018 스킴). 광역은 code[:2].

통합시(창원·수원 등)는 CSV 에 시 전체 한 줄, geojson 은 일반구 n개 → 시 방문자수를
n개 구에 **균등 분배**한다(사용자 확정). 구별 실제 편차는 무시하는 근사치.

demand_score 는 muslim_share 를 곱한 raw 값의 **백분위 랭크**(0~100). 상수 곱이라
시군구 간 순위는 바뀌지 않는다. 값이 없는(매칭 실패/스킵) 코드는 0.
trend_vs_2019 는 이 export 에 없어 전부 0.
"""
from __future__ import annotations

import csv
import json
import logging
from collections import defaultdict
from pathlib import Path

import pandas as pd

log = logging.getLogger(__name__)

# 광역지자체명 → code[:2] 2자리 접두. "특별자치" 등 개칭 형태도 함께 매핑.
GWANGYEOK_PREFIX: dict[str, str] = {
    "서울특별시": "11",
    "부산광역시": "21",
    "대구광역시": "22",
    "인천광역시": "23",
    "광주광역시": "24",
    "대전광역시": "25",
    "울산광역시": "26",
    "세종특별자치시": "29",
    "경기도": "31",
    "강원도": "32",
    "강원특별자치도": "32",
    "충청북도": "33",
    "충청남도": "34",
    "전라북도": "35",
    "전북특별자치도": "35",
    "전라남도": "36",
    "경상북도": "37",
    "경상남도": "38",
    "제주특별자치도": "39",
}

# CSV 기초명 → geojson 기초명 (표기가 다를 때만).
NAME_ALIASES: dict[str, str] = {
    "세종특별자치시": "세종시",  # CSV: 세종특별자치시,세종특별자치시 / geojson: 29010 세종시
}

# 2018 geojson 이 예측 못한 행정구역 변경 → (광역명, 기초명) → 5자리 코드.
# 군위군: 2023년 경북 → 대구 편입. 2018 geojson 은 접두 37(경북)로 유지하며
# 군위군 코드는 37310 (spec 초안의 37430 은 울릉군 — 실제 geojson 확인 후 정정).
# 이 목록은 검증 단계(A4)의 매칭 실패 로그에서 계속 채운다.
VINTAGE_OVERRIDES: dict[tuple[str, str], str] = {
    ("대구광역시", "군위군"): "37310",
    # 인천 미추홀구: 2018년 남구 → 미추홀구 개칭. 2018 geojson 은 23030 "남구".
    ("인천광역시", "미추홀구"): "23030",
}

# code[:2] → 영문 라벨. scripts/gen_datalab_sample.py 의 GWANGYEOK 과 동일.
# scripts↔pipeline 결합을 피하려고 이 모듈에 로컬 복사.
_GWANGYEOK_EN: dict[str, str] = {
    "11": "Seoul", "21": "Busan", "22": "Daegu", "23": "Incheon", "24": "Gwangju",
    "25": "Daejeon", "26": "Ulsan", "29": "Sejong", "31": "Gyeonggi", "32": "Gangwon",
    "33": "Chungbuk", "34": "Chungnam", "35": "Jeonbuk", "36": "Jeonnam",
    "37": "Gyeongbuk", "38": "Gyeongnam", "39": "Jeju",
}

_OUT_COLUMNS = ["sigungu_code", "sigungu_name", "gwangyeok", "demand_score", "trend_vs_2019"]


def _city_key(name: str) -> str:
    """일반구 접미(`[가-힣]+구`)를 떼되, 남는 부분이 `시` 로 끝날 때만.

    수원시장안구 → 수원시,  용산구 → 용산구(불변),  중구 → 중구(불변).
    """
    if name.endswith("구") and "시" in name[:-1]:
        return name[: name.rindex("시") + 1]
    return name


def _load_features(geojson: Path) -> list[tuple[str, str]]:
    geo = json.loads(Path(geojson).read_text(encoding="utf-8-sig"))
    out = []
    for f in geo["features"]:
        props = f["properties"]
        out.append((str(props["code"]), str(props["name"])))
    return out


def _build_indices(
    features: list[tuple[str, str]],
) -> tuple[dict[tuple[str, str], str], dict[tuple[str, str], list[str]]]:
    exact_index: dict[tuple[str, str], str] = {}
    prefix_index: dict[tuple[str, str], list[str]] = defaultdict(list)
    for code, name in features:
        p = code[:2]
        exact_index[(p, name)] = code
        prefix_index[(p, _city_key(name))].append(code)
    return exact_index, dict(prefix_index)


def _read_rows(regional_csv: Path):
    with Path(regional_csv).open(encoding="utf-8-sig") as fh:
        for row in csv.DictReader(fh):
            gw = str(row.get("광역지자체명", "")).strip()
            gu = str(row.get("기초지자체명", "")).strip()
            if not gw or not gu:
                continue
            try:
                raw = float(row.get("기초지자체 방문자 수", 0) or 0)
            except ValueError:
                raw = 0.0
            yield gw, gu, raw


def resolve_matches(
    regional_csv: Path, geojson: Path
) -> tuple[dict[str, float], list[str]]:
    """(code → raw 방문자수 map, 매칭 실패 "광역 기초" 문자열 리스트).

    A4 검증과 테스트가 정규화 없이 매칭 품질만 볼 수 있도록 분리한 헬퍼.
    통합시 균등분배가 적용된 raw 값(muslim_share 미적용)을 반환한다.
    """
    exact_index, prefix_index = _build_indices(_load_features(geojson))
    code_raw: dict[str, float] = {}
    unmatched: list[str] = []

    for gw, gu, raw in _read_rows(regional_csv):
        prefix = GWANGYEOK_PREFIX.get(gw)
        alias = NAME_ALIASES.get(gu, gu)

        if prefix is not None and (prefix, alias) in exact_index:
            code_raw[exact_index[(prefix, alias)]] = raw
        elif prefix is not None and (prefix, gu) in prefix_index:
            codes = prefix_index[(prefix, gu)]
            k = len(codes)
            for c in codes:
                code_raw[c] = raw / k
        elif (gw, gu) in VINTAGE_OVERRIDES:
            code_raw[VINTAGE_OVERRIDES[(gw, gu)]] = raw
        else:
            unmatched.append(f"{gw} {gu}")
            log.warning("unmatched region: %s %s", gw, gu)

    return code_raw, unmatched


def load_regional_demand(
    regional_csv: Path,
    geojson: Path,
    *,
    muslim_share: float = 1.0,
) -> pd.DataFrame:
    """데이터랩 지역별 방문자 CSV → gap_index.compute_gap 입력 형태.

    geojson feature 하나당 정확히 한 행(250개 코드 전부).
    """
    features = _load_features(geojson)
    code_raw, _ = resolve_matches(regional_csv, geojson)

    # 컬럼명 변경 등으로 방문자수가 전부 0/동일하면 rank(pct=True) 가 모두 100 을
    # 내놓아 조용히 망가진다 → 감지되면 전 지역 0 으로 방출.
    values = list(code_raw.values())
    degenerate = not values or max(values) <= 0 or len(set(values)) <= 1
    if degenerate:
        log.warning(
            "regional demand: raw visitor counts are missing/degenerate — emitting all-zero demand"
        )
        score: dict[str, int] = {}
    else:
        weighted = pd.Series({c: v * muslim_share for c, v in code_raw.items()}, dtype=float)
        # method="max": 통합시를 균등분할한 k개 구는 같은 raw 값을 가지므로 시 전체의
        # 순위를 공유한다 (구별로 순위를 깎지 않음)
        rank_pct = weighted.rank(pct=True, method="max")
        score = {c: int(round(r * 100)) for c, r in rank_pct.items()}

    rows = [
        {
            "sigungu_code": code,
            "sigungu_name": name,
            "gwangyeok": _GWANGYEOK_EN.get(code[:2], "Other"),
            "demand_score": score.get(code, 0),
            "trend_vs_2019": 0,
        }
        for code, name in features
    ]
    return pd.DataFrame(rows, columns=_OUT_COLUMNS)
