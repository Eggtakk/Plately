"""Notion 5단계 — 수요-공급 갭 지수. 데이터랩 방문자 수요 vs 후보 공급.
공식은 plately-web/scripts/gen-region-gap.mjs 에서 이식."""
from __future__ import annotations

import pandas as pd


def _clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def compute_gap(candidates: pd.DataFrame, demand: pd.DataFrame) -> pd.DataFrame:
    if len(candidates):
        codes = candidates["sigungu_code"].astype(str).str.strip()
        supply = codes.groupby(codes).size()
    else:
        supply = pd.Series(dtype=int)

    rows = []
    for _, d in demand.iterrows():
        code = str(d["sigungu_code"]).strip()
        demand_score = int(float(d["demand_score"]))
        supply_count = int(supply.get(code, 0))
        relief = supply_count / max(1, demand_score / 10)
        # JS Math.round 패리티 (clamp 이후라 항상 음이 아님)
        gap_index = int(_clamp(demand_score - relief * 30, 0, 100) + 0.5)
        ko = str(d["sigungu_name"])
        rows.append({
            "code": code,
            "name": {"en": ko, "ko": ko, "ar": ko, "hi": ko},
            "gwangyeok": str(d["gwangyeok"]),
            "demandScore": demand_score,
            "supplyCount": supply_count,
            "gapIndex": gap_index,
            "trendVs2019": int(float(d["trend_vs_2019"])),
        })
    return pd.DataFrame(rows)
