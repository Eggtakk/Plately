import json
from pathlib import Path
from scripts.run_pipeline import run

SAMPLES = Path(__file__).resolve().parents[1] / "data/samples"


def test_run_produces_three_files(tmp_path):
    run(
        localdata=SAMPLES / "localdata.sample.csv",
        tourapi_dir=SAMPLES / "tourapi",
        datalab=SAMPLES / "datalab-visitors.sample.csv",
        out_dir=tmp_path,
    )
    for f in ["restaurants.json", "region-gap.json", "_meta.json"]:
        assert (tmp_path / f).exists()


def test_region_gap_has_250_rows(tmp_path):
    run(localdata=SAMPLES / "localdata.sample.csv", tourapi_dir=SAMPLES / "tourapi",
        datalab=SAMPLES / "datalab-visitors.sample.csv", out_dir=tmp_path)
    gap = json.loads((tmp_path / "region-gap.json").read_text())
    assert len(gap) == 250


def test_pork_restaurants_excluded(tmp_path):
    run(localdata=SAMPLES / "localdata.sample.csv", tourapi_dir=SAMPLES / "tourapi",
        datalab=SAMPLES / "datalab-visitors.sample.csv", out_dir=tmp_path)
    rs = json.loads((tmp_path / "restaurants.json").read_text())
    names = {r["name"]["ko"] for r in rs}
    assert "남대문 돼지국밥" not in names       # 상호명 토큰
    assert "종로 삼겹살하우스" not in names     # 상호명 토큰
    assert "강남 초밥" not in names             # TourAPI treatmenu "돈까스" 재검사로 탈락
    assert "파리 비스트로" not in names         # bbox
    assert "용산 삼계탕집" in names
    assert "용산 한우곰탕" in names             # "수육"은 소고기로 흔해 탈락 안 함 (MENU_EXCLUDE_PORK)


def test_comparison_regions_have_supply(tmp_path):
    run(localdata=SAMPLES / "localdata.sample.csv", tourapi_dir=SAMPLES / "tourapi",
        datalab=SAMPLES / "datalab-visitors.sample.csv", out_dir=tmp_path)
    gap = {g["code"]: g for g in json.loads((tmp_path / "region-gap.json").read_text())}
    for code in ["11030", "21040", "33370"]:
        assert gap[code]["supplyCount"] >= 1


def test_all_restaurants_have_valid_confidence(tmp_path):
    run(localdata=SAMPLES / "localdata.sample.csv", tourapi_dir=SAMPLES / "tourapi",
        datalab=SAMPLES / "datalab-visitors.sample.csv", out_dir=tmp_path)
    rs = json.loads((tmp_path / "restaurants.json").read_text())
    assert all(r["confidence"] in {"name", "menu", "phone"} for r in rs)


def test_restaurants_json_is_valid_restaurant_shape(tmp_path):
    run(localdata=SAMPLES / "localdata.sample.csv", tourapi_dir=SAMPLES / "tourapi",
        datalab=SAMPLES / "datalab-visitors.sample.csv", out_dir=tmp_path)
    rs = json.loads((tmp_path / "restaurants.json").read_text())
    assert len(rs) >= 5
    for r in rs:
        assert set(r) >= {"id", "name", "area", "sigunguCode", "coords", "cuisine",
                          "attributes", "confidence", "matchedTokens", "repMenu"}
        assert len(r["attributes"]) == 14
        assert r["area"]["ko"] and not r["area"]["ko"].endswith(r["sigunguCode"])  # real district name, not raw code


def test_regional_mode_produces_250_regions_and_meta(tmp_path):
    fx = Path(__file__).resolve().parent / "fixtures"
    geo = Path(__file__).resolve().parents[2] / "plately-web/public/sigungu.simplified.geojson"
    run(localdata=SAMPLES / "localdata.sample.csv", tourapi_dir=SAMPLES / "tourapi",
        datalab=fx / "regional-mini.csv", out_dir=tmp_path,
        datalab_format="regional", datalab_country=fx / "country-mini.csv", geojson=geo)
    gap = json.loads((tmp_path / "region-gap.json").read_text())
    assert len(gap) == 250
    meta = json.loads((tmp_path / "_meta.json").read_text())
    assert meta["demandSource"] == "datalab-regional"
    assert 0.0 < meta["muslimShare"] < 1.0
    assert meta["sampleData"] is True
    by = {g["code"]: g for g in gap}
    # 용산구(11030) 900k > 음성군(33370) 40k → 용산 갭 demand 가 더 높음
    assert by["11030"]["demandScore"] > by["33370"]["demandScore"]


def test_committed_snapshot_matches_fresh_run(tmp_path):
    run(localdata=SAMPLES / "localdata.sample.csv", tourapi_dir=SAMPLES / "tourapi",
        datalab=SAMPLES / "datalab-visitors.sample.csv", out_dir=tmp_path)
    committed = Path(__file__).resolve().parents[1] / "out"
    for f in ["restaurants.json", "region-gap.json"]:
        assert json.loads((tmp_path / f).read_text()) == json.loads((committed / f).read_text()), f
    fresh_meta = json.loads((tmp_path / "_meta.json").read_text())
    old_meta = json.loads((committed / "_meta.json").read_text())
    for k in ["sampleData", "restaurants", "regions", "note", "demandSource"]:
        assert fresh_meta[k] == old_meta[k]
