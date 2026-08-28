"""모범음식점정보.csv (행안부, cp949) → 후보 식당에 붙일 menu_hint(주된음식종류).
Notion 2단계 토큰 매칭의 추가 신호. 조인 = (정규화 상호명, 시군구코드)."""
from __future__ import annotations

import pandas as pd

from pipeline.region_codes import RegionResolver

_NAME_COL = "업소명"
_STATUS_COL = "영업상태명"
_ROAD_ADDR_COL = "도로명주소"
_ADDR_COL = "소재지주소"
_MENU_COL = "주된음식종류"
_OPEN = "영업"


def _norm_name(s: str) -> str:
    return "".join(str(s).split()).upper()


def load_menu_hints(model_csv, resolver: RegionResolver) -> pd.DataFrame:
    """→ columns: join_name, sigungu_code, menu_hint  (영업중 + 주된음식종류 있는 행만)"""
    df = pd.read_csv(model_csv, encoding="cp949", dtype=str).fillna("")
    df = df[df[_STATUS_COL].str.strip() == _OPEN]
    df = df[df[_MENU_COL].str.strip() != ""]
    addr = df[_ADDR_COL].where(df[_ADDR_COL].str.strip() != "", df[_ROAD_ADDR_COL])
    out = pd.DataFrame({
        "join_name": df[_NAME_COL].map(_norm_name),
        "sigungu_code": addr.map(lambda a: resolver.resolve_from_address(a) or ""),
        "menu_hint": df[_MENU_COL].str.strip(),
    })
    out = out[(out["join_name"] != "") & (out["sigungu_code"] != "")]
    return out.drop_duplicates(subset=["join_name", "sigungu_code"], keep="first").reset_index(drop=True)


def annotate(candidates: pd.DataFrame, hints: pd.DataFrame) -> pd.DataFrame:
    """candidates(filter_localdata 출력: name, sigungu_code, lng, lat, biztype) + menu_hint 컬럼.
    조인 키 = (정규화 name, sigungu_code). 미매칭 → menu_hint=''"""
    if not len(candidates):
        return candidates.assign(menu_hint=pd.Series([], dtype=object))
    key = candidates["name"].map(_norm_name)
    lut = {(r.join_name, r.sigungu_code): r.menu_hint for r in hints.itertuples()}
    out = candidates.copy()
    out["menu_hint"] = [
        lut.get((k, str(c)), "") for k, c in zip(key, candidates["sigungu_code"].astype(str))
    ]
    return out
