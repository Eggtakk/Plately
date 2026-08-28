from scripts.fetch_localdata import build_params, parse_rows, total_count, _rows
from pipeline import schema


def test_build_params():
    p = build_params("KEY", 3, 500)
    assert p["serviceKey"] == "KEY" and p["pageNo"] == 3 and p["numOfRows"] == 500 and p["returnType"] == "json"
    assert "localCode" not in p
    assert build_params("K", 1, 10, local_code="11")["localCode"] == "11"


def test_parse_rows_datago_shape():
    body = {"response": {"body": {"items": {"item": [
        {"BPLC_NM": "행복식당", "SALS_STTS_NM": "영업/정상", "DTL_SALS_STTS_NM": "영업",
         "BZSTAT_SE_NM": "한식", "LOTNO_ADDR": "서울특별시 종로구 …", "CRD_INFO_X": "198000", "CRD_INFO_Y": "451000"},
    ]}, "totalCount": 1}}}
    out = parse_rows(body)
    assert len(out) == 1
    r = out[0]
    assert r[schema.NAME_COL] == "행복식당"
    assert r[schema.BIZTYPE_COL] == "한식"
    assert r[schema.X_COL] == "198000"


def test_parse_rows_single_item_not_list():
    body = {"response": {"body": {"items": {"item": {"BPLC_NM": "한집", "CRD_INFO_X": "1", "CRD_INFO_Y": "2"}}}}}
    assert parse_rows(body)[0][schema.NAME_COL] == "한집"


def test_parse_rows_localdata_style_fallback():
    body = {"result": {"row": [{"BPLC_NM": "국밥집", "LOTNO_ADDR": "부산 …"}]}}
    assert parse_rows(body)[0][schema.NAME_COL] == "국밥집"


def test_parse_rows_skips_nameless():
    body = {"response": {"body": {"items": {"item": [{"x": "1", "y": "2"}]}}}}
    assert parse_rows(body) == []


def test_rows_empty_shapes():
    assert _rows({}) == []
    assert _rows({"response": {"body": {"items": ""}}}) == []


def test_total_count():
    assert total_count({"response": {"body": {"totalCount": "70123"}}}) == 70123
    assert total_count({"response": {"body": {}}}) is None
