"""데이터랩 "외국인 지역별 방문자 수" export → gap_index 수요 입력 DataFrame.

CSV 컬럼: 광역지자체명, 기초지자체명, 광역지자체 방문자 수, 광역지자체 방문자 비율,
          기초지자체 방문자 수, 기초지자체 방문자 비율

geojson feature = {code: "11030", name: "용산구"} (kostat-2018 스킴). 광역은 code[:2].

통합시(창원·수원 등)는 CSV 에 시 전체 한 줄, geojson 은 일반구 n개 → 시 방문자수를
n개 구에 **균등 분배**한다(사용자 확정). 구별 실제 편차는 무시하는 근사치.

demand_score 는 muslim_share 를 곱한 raw 값의 **백분위 랭크**(0~100). 상수 곱이라
시군구 간 순위는 바뀌지 않는다. 값이 없는(매칭 실패/스킵) 코드는 0.
trend_vs_2019 는 이 export 에 없어 전부 0.

지역명 → 코드 매칭은 pipeline.region_codes.RegionResolver 로 분리했다. 아래 상수
(GWANGYEOK_PREFIX / NAME_ALIASES / VINTAGE_OVERRIDES / GWANGYEOK_EN / _city_key)는
기존 import 호환을 위해 이 모듈에서 재노출한다.
"""
from __future__ import annotations

import csv
import logging
from pathlib import Path

import pandas as pd

from pipeline.region_codes import (
    GWANGYEOK_EN,
    GWANGYEOK_PREFIX,
    NAME_ALIASES,
    RegionResolver,
    VINTAGE_OVERRIDES,
    _city_key,
)

log = logging.getLogger(__name__)

# 하위 호환: 예전 이름(_GWANGYEOK_EN)으로도 접근 가능하게 유지.
_GWANGYEOK_EN = GWANGYEOK_EN

__all__ = [
    "GWANGYEOK_PREFIX",
    "NAME_ALIASES",
    "VINTAGE_OVERRIDES",
    "GWANGYEOK_EN",
    "RegionResolver",
    "_city_key",
    "resolve_matches",
    "load_regional_demand",
]

_OUT_COLUMNS = ["sigungu_code", "sigungu_name", "gwangyeok", "demand_score", "trend_vs_2019"]


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
    resolver = RegionResolver(geojson)
    code_raw: dict[str, float] = {}
    unmatched: list[str] = []

    for gw, gu, raw in _read_rows(regional_csv):
        codes = resolver.resolve_codes(gw, gu)
        if not codes:
            unmatched.append(f"{gw} {gu}")
            log.warning("unmatched region: %s %s", gw, gu)
            continue
        k = len(codes)
        if k == 1:
            code_raw[codes[0]] = raw
        else:
            for c in codes:
                code_raw[c] = raw / k

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
    resolver = RegionResolver(geojson)
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
            "sigungu_name": resolver.name_of(code),
            "gwangyeok": resolver.gwangyeok_en(code),
            "demand_score": score.get(code, 0),
            "trend_vs_2019": 0,
        }
        for code in resolver.all_codes()
    ]
    return pd.DataFrame(rows, columns=_OUT_COLUMNS)
