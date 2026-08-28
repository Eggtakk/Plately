import json
import pandas as pd
from pipeline.emit import to_restaurants, to_region_gap, build_meta

_ATTR_KEYS = {
    "containsPork", "servesAlcohol", "containsBeef", "vegetarianFriendly",
    "containsChicken", "containsFish", "containsSeafood", "containsEgg",
    "containsOnionGarlic", "porkDerivedIngredients", "containsGelatin",
    "nonHalalMeat", "halalCertified", "crossContaminationRisk",
}


def _candidate_row():
    return {
        "name": "용산 삼계탕집", "sigungu_code": "11030", "lng": 126.9779, "lat": 37.5384,
        "biztype": "한식", "cuisine": "korean-chicken",
        "containsPork": False, "containsBeef": False, "containsChicken": True,
        "containsFish": False, "containsSeafood": False, "vegetarianFriendly": False,
        "servesAlcohol": "unknown", "containsEgg": False, "containsOnionGarlic": False,
        "halalCertified": False, "porkDerivedIngredients": "unknown",
        "containsGelatin": "unknown", "nonHalalMeat": "unknown",
        "crossContaminationRisk": "unknown",
        "matchedTokens": ["삼계탕"], "repMenu": ["삼계탕"], "confidence": "name",
    }


def _gap_row():
    return {
        "code": "11030", "name": {"en": "용산구", "ko": "용산구", "ar": "용산구", "hi": "용산구"},
        "gwangyeok": "Seoul", "demandScore": 70, "supplyCount": 2, "gapIndex": 40, "trendVs2019": 5,
    }


def test_restaurant_shape():
    out = to_restaurants(pd.DataFrame([_candidate_row()]))
    r = out[0]
    assert set(r) == {"id", "name", "area", "sigunguCode", "coords", "cuisine",
                      "attributes", "confidence", "matchedTokens", "repMenu"}
    assert set(r["attributes"]) == _ATTR_KEYS
    assert r["coords"] == [126.9779, 37.5384]
    assert set(r["name"]) == {"en", "ko", "ar", "hi"}


def test_restaurant_id_is_deterministic_and_unique():
    df = pd.DataFrame([_candidate_row(), {**_candidate_row(), "name": "다른집"}])
    ids = [r["id"] for r in to_restaurants(df)]
    assert len(set(ids)) == 2
    assert to_restaurants(df)[0]["id"] == to_restaurants(df)[0]["id"]


def test_restaurant_area_uses_region_names():
    out = to_restaurants(pd.DataFrame([_candidate_row()]), region_names={"11030": "용산구"})
    assert out[0]["area"]["ko"] == "서울 용산구"


def test_restaurant_area_falls_back_to_code_without_region_names():
    out = to_restaurants(pd.DataFrame([_candidate_row()]))
    assert out[0]["area"]["ko"] == "서울 11030"


def test_id_unique_for_same_name_different_coords():
    a = _candidate_row()
    b = {**_candidate_row(), "lng": 126.99, "lat": 37.54}
    ids = [r["id"] for r in to_restaurants(pd.DataFrame([a, b]))]
    assert len(set(ids)) == 2


def test_clean_converts_numpy_and_nonfinite():
    import numpy as np
    from pipeline.emit import _clean
    assert _clean(np.int64(5)) == 5 and isinstance(_clean(np.int64(5)), int)
    assert _clean(np.bool_(True)) is True
    assert _clean(np.float64("nan")) is None


def test_empty_dataframe_yields_empty_list():
    assert to_restaurants(pd.DataFrame(columns=["name", "sigungu_code", "lng", "lat", "cuisine", "confidence", "matchedTokens", "repMenu", *_ATTR_KEYS])) == []
    assert to_region_gap(pd.DataFrame(columns=["code", "name", "gwangyeok", "demandScore", "supplyCount", "gapIndex", "trendVs2019"])) == []


def test_phone_verified_passthrough():
    row = {**_candidate_row(), "phoneVerifiedOn": "2026-03-14", "confidence": "phone"}
    out = to_restaurants(pd.DataFrame([row]))[0]
    assert out["phoneVerifiedOn"] == "2026-03-14"


def test_region_gap_passthrough():
    out = to_region_gap(pd.DataFrame([_gap_row()]))
    assert out[0]["code"] == "11030"
    assert set(out[0]) == {"code", "name", "gwangyeok", "demandScore", "supplyCount", "gapIndex", "trendVs2019"}


def test_meta_marks_sample():
    m = build_meta(restaurants=10, regions=250)
    assert m["sampleData"] is True
    assert m["restaurants"] == 10 and m["regions"] == 250
    assert "generatedAt" in m
    assert m["demandSource"] == "sample"
    assert "muslimShare" not in m


def test_meta_regional_source_and_share():
    m = build_meta(12, 250, demand_source="datalab-regional-2026-08", muslim_share=0.0902)
    assert m["demandSource"] == "datalab-regional-2026-08"
    assert m["muslimShare"] == 0.0902
    assert m["sampleData"] is True  # restaurants 는 여전히 샘플


def test_output_is_json_serializable():
    # emit output feeds json.dumps in run_pipeline — guard against numpy leakage
    json.dumps(to_restaurants(pd.DataFrame([_candidate_row()])), ensure_ascii=False)
    json.dumps(to_region_gap(pd.DataFrame([_gap_row()])), ensure_ascii=False)
    json.dumps(build_meta(1, 1))
