import pandas as pd
from pipeline.localdata_filter import filter_localdata
from pipeline import schema


def _row(**over):
    base = {
        schema.NAME_COL: "행복식당",
        schema.STATUS_COL: schema.OPEN_STATUS_NAME,
        schema.DETAIL_STATUS_COL: "영업중",
        schema.BIZTYPE_COL: "한식",
        schema.SIGUNGU_CODE_COL: "11010",
        schema.LNG_COL: 126.98,
        schema.LAT_COL: 37.57,
    }
    base.update(over)
    return base


def test_keeps_operating_restaurant():
    df = pd.DataFrame([_row()])
    out = filter_localdata(df)
    assert len(out) == 1


def test_drops_closed():
    df = pd.DataFrame([_row(**{schema.DETAIL_STATUS_COL: "폐업"})])
    assert len(filter_localdata(df)) == 0


def test_drops_non_open_status():
    df = pd.DataFrame([_row(**{schema.STATUS_COL: "폐업"})])
    assert len(filter_localdata(df)) == 0


def test_drops_alcohol_business_type():
    df = pd.DataFrame([_row(**{schema.BIZTYPE_COL: "유흥주점"})])
    assert len(filter_localdata(df)) == 0


def test_drops_out_of_bbox_coords():
    df = pd.DataFrame([_row(**{schema.LNG_COL: 2.35, schema.LAT_COL: 48.85})])  # 파리
    assert len(filter_localdata(df)) == 0


def test_normalizes_columns():
    out = filter_localdata(pd.DataFrame([_row()]))
    assert list(out.columns) == ["name", "sigungu_code", "lng", "lat", "biztype"]


def test_drops_nan_coords():
    df = pd.DataFrame([_row(**{schema.LNG_COL: float("nan"), schema.LAT_COL: float("nan")})])
    assert len(filter_localdata(df)) == 0


def test_strips_and_casts_values():
    out = filter_localdata(pd.DataFrame([_row(**{schema.NAME_COL: "  행복식당  "})]))
    assert out["name"].iloc[0] == "행복식당"
    assert out["lng"].dtype == float
