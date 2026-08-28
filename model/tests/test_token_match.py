import pandas as pd
from pipeline.token_match import match_tokens


def _df(*names):
    return pd.DataFrame(
        {"name": list(names), "sigungu_code": ["11010"] * len(names),
         "lng": [127.0] * len(names), "lat": [37.5] * len(names),
         "biztype": ["한식"] * len(names)}
    )


def test_pork_name_is_dropped_as_candidate():
    out = match_tokens(_df("남대문 돼지국밥", "용산 삼계탕집"))
    assert list(out["name"]) == ["용산 삼계탕집"]


def test_chicken_axis_sets_contains_chicken_true_pork_false():
    out = match_tokens(_df("용산 삼계탕집")).iloc[0]
    assert out["containsChicken"] is True
    assert out["containsPork"] is False
    assert out["containsBeef"] is False


def test_beef_axis():
    out = match_tokens(_df("종로 설렁탕")).iloc[0]
    assert out["containsBeef"] is True
    assert out["cuisine"] == "korean-beef"


def test_seafood_fish_split():
    out = match_tokens(_df("부산 대구탕", "속초 조개구이")).set_index("name")
    assert out.loc["부산 대구탕", "containsFish"] is True
    assert out.loc["속초 조개구이", "containsSeafood"] is True


def test_vegetarian_axis():
    out = match_tokens(_df("인사동 사찰음식")).iloc[0]
    assert out["vegetarianFriendly"] is True
    assert out["cuisine"] == "temple"


def test_serves_alcohol_unknown_from_name_only():
    out = match_tokens(_df("용산 삼계탕집")).iloc[0]
    assert out["servesAlcohol"] == "unknown"


def test_matched_tokens_recorded():
    out = match_tokens(_df("이태원 할랄 케밥")).iloc[0]
    assert set(out["matchedTokens"]) >= {"케밥", "할랄"}
    assert out["confidence"] == "name"


def test_unknown_tristate_fields_default_unknown():
    out = match_tokens(_df("용산 삼계탕집")).iloc[0]
    for f in ["porkDerivedIngredients", "containsGelatin", "nonHalalMeat", "crossContaminationRisk"]:
        assert out[f] == "unknown"


def test_strict_boolean_fields_default_false():
    out = match_tokens(_df("용산 삼계탕집")).iloc[0]
    for f in ["containsEgg", "containsOnionGarlic", "halalCertified"]:
        assert out[f] is False


def test_muslim_axis():
    out = match_tokens(_df("이태원 할랄 케밥")).iloc[0]
    assert out["cuisine"] == "halal"
    assert out["halalCertified"] is False


def test_multi_axis_priority():
    out = match_tokens(_df("한우 물회")).iloc[0]
    assert out["containsBeef"] is True
    assert out["containsFish"] is True
    assert out["cuisine"] == "korean-beef"
    assert set(out["matchedTokens"]) >= {"한우", "물회"}


def test_no_axis_match_is_dropped():
    out = match_tokens(_df("그냥 분식집"))
    assert len(out) == 0
    assert list(match_tokens(_df("그냥 분식집")).columns) == list(
        match_tokens(_df("용산 삼계탕집")).columns
    )


def test_menu_hint_pork_token_drops_candidate():
    df = _df("일미식당")           # name alone: no axis match → would be dropped anyway
    df["menu_hint"] = ["삼겹살"]   # ... but even with a hint, 삼겹살 → containsPork → dropped
    assert len(match_tokens(df)) == 0


def test_menu_hint_promotes_via_axis_token():
    df = _df("행복회관")           # name: no axis match
    df["menu_hint"] = ["조개"]     # hint has seafood token → promoted
    out = match_tokens(df)
    assert len(out) == 1 and out.iloc[0]["containsSeafood"] is True


def test_menu_hint_pork_beats_axis():
    df = _df("바다식당")
    df["menu_hint"] = ["돼지갈비 물회"]   # both a pork and a seafood token
    assert len(match_tokens(df)) == 0     # pork wins → dropped


def test_no_menu_hint_column_is_unchanged():
    out = match_tokens(_df("용산 삼계탕집"))   # no menu_hint col at all
    assert len(out) == 1
