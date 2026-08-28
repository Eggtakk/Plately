import pandas as pd
from pipeline.gap_index import compute_gap


def _demand():
    return pd.DataFrame([
        {"sigungu_code": "11030", "sigungu_name": "용산구", "gwangyeok": "Seoul",
         "demand_score": 80, "trend_vs_2019": 12},
        {"sigungu_code": "21040", "sigungu_name": "영도구", "gwangyeok": "Busan",
         "demand_score": 40, "trend_vs_2019": -5},
        {"sigungu_code": "33370", "sigungu_name": "음성군", "gwangyeok": "Chungbuk",
         "demand_score": 20, "trend_vs_2019": 3},
    ])


def _candidates():
    return pd.DataFrame([
        {"sigungu_code": "11030", "name": "a"},
        {"sigungu_code": "11030", "name": "b"},
        {"sigungu_code": "21040", "name": "c"},
    ])


def test_row_per_demand_region():
    out = compute_gap(_candidates(), _demand())
    assert set(out["code"]) == {"11030", "21040", "33370"}


def test_supply_count_from_candidates():
    out = compute_gap(_candidates(), _demand()).set_index("code")
    assert out.loc["11030", "supplyCount"] == 2
    assert out.loc["33370", "supplyCount"] == 0


def test_gap_index_within_0_100():
    out = compute_gap(_candidates(), _demand())
    assert out["gapIndex"].between(0, 100).all()


def test_high_demand_no_supply_has_high_gap():
    demand = _demand()
    out = compute_gap(pd.DataFrame(columns=["sigungu_code", "name"]), demand).set_index("code")
    assert out.loc["11030", "gapIndex"] > out.loc["33370", "gapIndex"]


def test_exact_gap_and_trend_passthrough():
    out = compute_gap(_candidates(), _demand()).set_index("code")
    assert out.loc["21040", "gapIndex"] == 33   # demand 40, supply 1 → 40 - 0.25*30 = 32.5 → round-half-up 33
    assert out.loc["21040", "trendVs2019"] == -5
    assert out.loc["11030", "gapIndex"] == 73   # demand 80, supply 2 → 80 - 7.5 = 72.5 → 73


def test_name_shape_matches_localizedname():
    out = compute_gap(_candidates(), _demand()).iloc[0]
    assert set(out["name"]) == {"en", "ko", "ar", "hi"}
