"""Notion 2단계 — 상호명 토큰 매칭. 이진 판정이 아니라 축별 독립 boolean
컬럼을 만든다 (Notion "이진 라벨 → 다차원 속성 태그").

입력: localdata_filter 출력 (name, sigungu_code, lng, lat, biztype)
출력: 위 + RestaurantAttributes 축별 컬럼 + matchedTokens + cuisine + confidence
후보 승격 안 된 행(포크 매칭 or 축 매칭 0)은 제거.
"""
from __future__ import annotations

import pandas as pd

from pipeline import tokens

_UNKNOWN_FIELDS = ["porkDerivedIngredients", "containsGelatin", "nonHalalMeat", "crossContaminationRisk"]

# _match_one 이 각 행에 추가하는 컬럼 — 순서 포함. _match_one 결과 dict 의
# .keys() 와 정확히 일치해야 한다. 빈 프레임도 populated 프레임과 동일한
# 스키마를 갖도록 여기서 단일 소스로 관리한다 (Task 7/8 downstream).
_ADDED_COLUMNS = [
    "containsPork", "containsBeef", "containsChicken", "containsFish", "containsSeafood",
    "vegetarianFriendly", "servesAlcohol", "containsEgg", "containsOnionGarlic", "halalCertified",
    "matchedTokens", "cuisine", "confidence",
    "porkDerivedIngredients", "containsGelatin", "nonHalalMeat", "crossContaminationRisk",
]

# astype(object) coercion 에서 건드리지 않을 숫자 컬럼
_NUMERIC_COLS = {"lng", "lat"}


def _found(text: str, needles) -> list[str]:
    up = text.upper()
    return [n for n in needles if n.upper() in up]


def _match_one(name: str, extra_text: str = "") -> dict | None:
    hay = f"{name} {extra_text}".strip()
    hits = _found(hay, tokens.EXCLUDE_PORK)
    contains_pork = len(hits) > 0

    axis_hits: dict[str, list[str]] = {}
    for axis, needles in tokens.INCLUDE_AXES.items():
        found = _found(hay, needles)
        if found:
            axis_hits[axis] = found

    if contains_pork or not axis_hits:
        return None  # 후보 미승격

    matched = sorted({t for lst in axis_hits.values() for t in lst})
    seafood_hits = axis_hits.get("seafood", [])
    contains_fish = any(t in tokens.FISH_TOKENS for t in seafood_hits)
    contains_seafood = any(t not in tokens.FISH_TOKENS for t in seafood_hits)

    # 주 cuisine: 매칭된 첫 축 우선순위 (muslim > vegetarian > beef > seafood > chicken)
    for axis in ["muslim", "vegetarian", "beef", "seafood", "chicken"]:
        if axis in axis_hits:
            cuisine = tokens.AXIS_TO_CUISINE[axis]
            break
    else:
        # 도달 불가 방어: axis_hits 키 ⊆ INCLUDE_AXES ⊆ 위 우선순위 리스트.
        cuisine = "korean"

    row = {
        "containsPork": False,
        "containsBeef": "beef" in axis_hits,
        "containsChicken": "chicken" in axis_hits,
        "containsFish": contains_fish,
        "containsSeafood": contains_seafood,
        "vegetarianFriendly": "vegetarian" in axis_hits,
        "servesAlcohol": "unknown",
        "containsEgg": False,
        "containsOnionGarlic": False,
        "halalCertified": False,  # 검증 전엔 항상 False
        "matchedTokens": matched,
        "cuisine": cuisine,
        "confidence": "name",
    }
    for f in _UNKNOWN_FIELDS:
        row[f] = "unknown"
    return row


def match_tokens(df: pd.DataFrame) -> pd.DataFrame:
    records = []
    for _, r in df.iterrows():
        hint = str(r["menu_hint"]) if "menu_hint" in df.columns and pd.notna(r.get("menu_hint")) else ""
        m = _match_one(str(r["name"]), hint)
        if m is None:
            continue
        records.append({**r.to_dict(), **m})
    if not records:
        return pd.DataFrame(columns=list(df.columns) + _ADDED_COLUMNS)
    out = pd.DataFrame(records)
    # pandas 가 all-bool/all-str 컬럼을 numpy dtype (numpy.bool_ 등) 으로 추론하면
    # Task 8 의 JSON emit 시 순수 파이썬 값이 아니어서 json.dumps 가 깨지고,
    # .loc[row, col] 스칼라 접근이 numpy.bool_ 를 돌려줘 `is True` 체크도 깨진다.
    # object dtype 으로 되돌려 순수 파이썬 bool/str/list 값을 보존한다.
    obj_cols = [c for c in out.columns if c not in _NUMERIC_COLS]
    out = out.astype({c: object for c in obj_cols})
    return out.reset_index(drop=True)
