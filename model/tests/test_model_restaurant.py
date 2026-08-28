import pandas as pd
from pathlib import Path
from pipeline.model_restaurant import load_menu_hints, annotate
from pipeline.region_codes import RegionResolver

GEOJSON = Path(__file__).resolve().parents[2] / "plately-web/public/sigungu.simplified.geojson"
FIX = Path(__file__).resolve().parent / "fixtures/model-restaurant-mini.csv"


def test_load_menu_hints_filters_and_resolves():
    h = load_menu_hints(FIX, RegionResolver(GEOJSON))
    names = set(h["join_name"])
    assert "용산삼계탕집".upper() in names or "용산 삼계탕집".replace(" ", "").upper() in names
    assert "폐업한집".upper() not in names          # status
    assert "빈메뉴집".upper() not in names          # empty menu
    assert "주소이상집".upper() not in names        # unresolvable address
    assert set(h["menu_hint"]) >= {"삼계탕", "삼겹살", "생선회"}
    assert (h["sigungu_code"].str.len() == 5).all()


def test_annotate_joins_by_name_and_code():
    h = load_menu_hints(FIX, RegionResolver(GEOJSON))
    cand = pd.DataFrame({
        "name": ["용산 삼계탕집", "일미식당", "무관한집"],
        "sigungu_code": ["11030", "11010", "11030"],
        "lng": [127.0, 127.0, 127.0], "lat": [37.5, 37.5, 37.5], "biztype": ["한식"] * 3,
    })
    out = annotate(cand, h).set_index("name")
    assert out.loc["용산 삼계탕집", "menu_hint"] == "삼계탕"
    assert out.loc["일미식당", "menu_hint"] == "삼겹살"
    assert out.loc["무관한집", "menu_hint"] == ""


def test_annotate_empty_candidates():
    h = load_menu_hints(FIX, RegionResolver(GEOJSON))
    out = annotate(pd.DataFrame(columns=["name", "sigungu_code", "lng", "lat", "biztype"]), h)
    assert "menu_hint" in out.columns and len(out) == 0
