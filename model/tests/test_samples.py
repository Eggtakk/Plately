import csv
import json
from pathlib import Path

SAMPLES = Path(__file__).resolve().parents[1] / "data/samples"
GEOJSON = Path(__file__).resolve().parents[2] / "plately-web/public/sigungu.simplified.geojson"


def _geojson_codes():
    g = json.loads(GEOJSON.read_text(encoding="utf-8"))
    return {str(f["properties"]["code"]) for f in g["features"]}


def test_localdata_sample_header_matches_schema():
    from pipeline import schema
    with (SAMPLES / "localdata.sample.csv").open(encoding="utf-8") as fh:
        header = next(csv.reader(fh))
    for col in [schema.NAME_COL, schema.STATUS_COL, schema.DETAIL_STATUS_COL,
                schema.BIZTYPE_COL, schema.SIGUNGU_CODE_COL, schema.LNG_COL, schema.LAT_COL]:
        assert col in header


def test_all_localdata_sample_codes_exist_in_geojson():
    codes = _geojson_codes()
    with (SAMPLES / "localdata.sample.csv").open(encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            assert row["sigungu_code"] in codes, row["sigungu_code"]


def test_datalab_sample_matches_geojson_rowcount():
    with (SAMPLES / "datalab-visitors.sample.csv").open(encoding="utf-8") as fh:
        rows = list(csv.DictReader(fh))
    assert len(rows) == len(_geojson_codes())
    assert {"sigungu_code", "sigungu_name", "gwangyeok", "demand_score", "trend_vs_2019"} == set(rows[0])


def test_comparison_region_codes_present_in_datalab():
    with (SAMPLES / "datalab-visitors.sample.csv").open(encoding="utf-8") as fh:
        codes = {r["sigungu_code"] for r in csv.DictReader(fh)}
    assert {"11030", "21040", "33370"} <= codes


def test_tourapi_fixtures_are_valid_json_with_title():
    files = list((SAMPLES / "tourapi").glob("*.json"))
    assert len(files) >= 7
    for p in files:
        d = json.loads(p.read_text(encoding="utf-8"))
        assert d["title"] and "firstmenu" in d and "treatmenu" in d
