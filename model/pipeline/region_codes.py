"""광역/기초 지자체명 → 5자리 시군구 코드 리졸버.

geojson(kostat-2018)의 feature {code, name} + code[:2] 접두로 광역 파생.
datalab_adapter / localdata_adapter 공용.
"""
from __future__ import annotations

import json
from collections import defaultdict
from pathlib import Path

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
    # 2026 인천 행정구 개편 → 2018 geojson 의 이전 구로 매핑.
    ("인천광역시", "영종구"): "23010",   # 중구에서 분리
    ("인천광역시", "검단구"): "23080",   # 서구에서 분리
    ("인천광역시", "제물포구"): "23030",  # 미추홀구 = 2018 "남구"
}

# code[:2] → 영문 라벨. scripts/gen_datalab_sample.py 의 GWANGYEOK 과 동일.
# scripts↔pipeline 결합을 피하려고 이 모듈에 로컬 복사.
GWANGYEOK_EN: dict[str, str] = {
    "11": "Seoul", "21": "Busan", "22": "Daegu", "23": "Incheon", "24": "Gwangju",
    "25": "Daejeon", "26": "Ulsan", "29": "Sejong", "31": "Gyeonggi", "32": "Gangwon",
    "33": "Chungbuk", "34": "Chungnam", "35": "Jeonbuk", "36": "Jeonnam",
    "37": "Gyeongbuk", "38": "Gyeongnam", "39": "Jeju",
}


def _city_key(name: str) -> str:
    """일반구 접미(`[가-힣]+구`)를 떼되, 남는 부분이 `시` 로 끝날 때만.

    수원시장안구 → 수원시,  용산구 → 용산구(불변),  중구 → 중구(불변).
    """
    if name.endswith("구") and "시" in name[:-1]:
        return name[: name.rindex("시") + 1]
    return name


class RegionResolver:
    """geojson feature 집합에서 광역/기초명 → 코드 매칭 사다리를 제공."""

    def __init__(self, geojson_path):
        geo = json.loads(Path(geojson_path).read_text(encoding="utf-8-sig"))
        self._exact: dict[tuple[str, str], str] = {}
        _prefix: dict[tuple[str, str], list[str]] = defaultdict(list)
        self._names: dict[str, str] = {}  # code -> geojson name
        for f in geo["features"]:
            props = f["properties"]
            code = str(props["code"])
            name = str(props["name"])
            p = code[:2]
            self._exact[(p, name)] = code
            _prefix[(p, _city_key(name))].append(code)
            self._names[code] = name
        self._prefix: dict[tuple[str, str], list[str]] = dict(_prefix)

    def resolve_codes(self, gwangyeok: str, sigungu: str) -> list[str]:
        """통합시면 여러 코드, 정확 매칭이면 1개, 실패면 []. (호출측이 균등분배 결정)

        매칭 사다리는 datalab_adapter 의 기존 동작을 그대로 보존한다:
        1) (접두, alias) 정확 매칭   2) (접두, 원본 기초명) 접두 매칭
        3) VINTAGE_OVERRIDES[(광역명, 기초명)]  (접두 유무와 무관하게 검사)
        """
        gw = str(gwangyeok).strip()
        gu = str(sigungu).strip()
        prefix = GWANGYEOK_PREFIX.get(gw)
        if prefix is not None:
            alias = NAME_ALIASES.get(gu, gu)
            if (prefix, alias) in self._exact:
                return [self._exact[(prefix, alias)]]
            if (prefix, gu) in self._prefix:
                return list(self._prefix[(prefix, gu)])
        ov = VINTAGE_OVERRIDES.get((gw, gu))
        return [ov] if ov else []

    def resolve(self, gwangyeok: str, sigungu: str) -> str | None:
        codes = self.resolve_codes(gwangyeok, sigungu)
        return codes[0] if codes else None

    def resolve_from_address(self, address: str) -> str | None:
        """'서울특별시 종로구 세종대로 …' / '경기도 수원시 장안구 …' / '세종특별자치시 …'
        → 5자리 시군구 코드. 실패 → None."""
        parts = str(address).strip().split()
        if len(parts) < 2:
            return None
        gw = parts[0]
        if gw not in GWANGYEOK_PREFIX:
            return None
        # 세종: 기초 == 광역
        if gw == "세종특별자치시":
            return self.resolve(gw, gw)
        gu = parts[1]
        # 통합시 일반구: parts[1]=…시, parts[2]=…구  → 붙여서 시도
        if len(parts) >= 3 and gu.endswith("시") and parts[2].endswith("구"):
            merged = self.resolve(gw, gu + parts[2])
            if merged:
                return merged
        codes = self.resolve_codes(gw, gu)
        if len(codes) > 1:
            return None   # 통합시인데 주소에 일반구가 없음 → 모호
        return codes[0] if codes else None

    def name_of(self, code: str) -> str | None:
        return self._names.get(str(code))

    def gwangyeok_en(self, code: str) -> str:
        return GWANGYEOK_EN.get(str(code)[:2], "Other")

    def all_codes(self) -> list[str]:
        return list(self._names)
