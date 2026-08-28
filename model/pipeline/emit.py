"""DataFrame → plately-web/lib/types.ts 형태의 dict/list.
이 파일이 Python ↔ TS 인터페이스 유일 접점. test_emit.py 가 키/타입을 고정한다."""
from __future__ import annotations

import datetime as _dt
import hashlib
import math
import re

import pandas as pd

_ATTR_FIELDS = [
    "containsPork", "servesAlcohol", "containsBeef", "vegetarianFriendly",
    "containsChicken", "containsFish", "containsSeafood", "containsEgg",
    "containsOnionGarlic", "porkDerivedIngredients", "containsGelatin",
    "nonHalalMeat", "halalCertified", "crossContaminationRisk",
]

_GWANGYEOK_KO_BY_PREFIX = {
    "11": "서울", "21": "부산", "22": "대구", "23": "인천", "24": "광주",
    "25": "대전", "26": "울산", "29": "세종", "31": "경기", "32": "강원",
    "33": "충북", "34": "충남", "35": "전북", "36": "전남",
    "37": "경북", "38": "경남", "39": "제주",
}


def _slug(name: str, lng: float, lat: float) -> str:
    key = f"{name}|{lng:.6f}|{lat:.6f}"
    h = hashlib.sha1(key.encode("utf-8")).hexdigest()[:10]
    ascii_part = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return f"{ascii_part}-{h}" if ascii_part else h


def _loc(ko: str) -> dict:
    return {"en": ko, "ko": ko, "ar": ko, "hi": ko}


def _clean(v):
    """numpy 스칼라 → 파이썬 네이티브. 비유한 float(NaN/inf) → None (JSON.parse 호환)."""
    if hasattr(v, "item"):
        v = v.item()
    if isinstance(v, float) and not math.isfinite(v):
        return None
    return v


def to_restaurants(df: pd.DataFrame, region_names: dict[str, str] | None = None) -> list[dict]:
    names = region_names or {}
    out = []
    for _, r in df.iterrows():
        code = str(r["sigungu_code"]).strip()
        name = str(r["name"]).strip()
        gwang = _GWANGYEOK_KO_BY_PREFIX.get(code[:2], "")
        district = names.get(code, code)
        area = f"{gwang} {district}".strip()
        rec = {
            "id": f"r-{code}-{_slug(name, float(r['lng']), float(r['lat']))}",
            "name": _loc(name),
            "area": _loc(area),
            "sigunguCode": code,
            "coords": [round(float(r["lng"]), 6), round(float(r["lat"]), 6)],
            "cuisine": str(r["cuisine"]),
            "attributes": {f: _clean(r[f]) for f in _ATTR_FIELDS},
            "confidence": str(r["confidence"]),
            "matchedTokens": [str(t) for t in r["matchedTokens"]],
            "repMenu": [str(t) for t in r["repMenu"]] if isinstance(r.get("repMenu"), (list, tuple)) else [],
        }
        pv = r.get("phoneVerifiedOn")
        if pd.notna(pv) and str(pv).strip():
            rec["phoneVerifiedOn"] = str(pv)
        out.append(rec)
    return out


def to_region_gap(df: pd.DataFrame) -> list[dict]:
    cols = ["code", "name", "gwangyeok", "demandScore", "supplyCount", "gapIndex", "trendVs2019"]
    return [{c: _clean(r[c]) for c in cols} for _, r in df.iterrows()]


def build_meta(restaurants: int, regions: int, *, demand_source: str = "sample",
               supply_source: str = "sample", muslim_share: float | None = None) -> dict:
    if supply_source not in ("sample", "localdata-api"):
        raise ValueError(f"supply_source: {supply_source!r}")
    meta = {
        "sampleData": supply_source == "sample",   # 식당 목록이 손 작성 샘플인지
        "demandSource": demand_source,   # "sample" | "datalab-regional-<YYYY-MM>"
        "supplySource": supply_source,   # "sample" | "localdata-api"
        "generatedAt": _dt.datetime.now(_dt.timezone.utc).isoformat(timespec="seconds"),
        "restaurants": int(restaurants),
        "regions": int(regions),
        "note": "수요는 demandSource, 공급(식당)은 supplySource 참조",
    }
    if muslim_share is not None:
        meta["muslimShare"] = round(float(muslim_share), 4)
    return meta
