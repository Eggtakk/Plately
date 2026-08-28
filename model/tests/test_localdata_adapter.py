import pandas as pd
from pathlib import Path

from pipeline.localdata_adapter import normalize
from pipeline.localdata_filter import filter_localdata
from pipeline.region_codes import RegionResolver
from pipeline import schema

GEOJSON = Path(__file__).resolve().parents[2] / "plately-web/public/sigungu.simplified.geojson"
FIX = Path(__file__).resolve().parent / "fixtures/localdata-real-sample.csv"


def test_normalize_adds_lng_lat_sigungu():
    raw = pd.read_csv(FIX, dtype=str)
    out = normalize(raw, RegionResolver(GEOJSON))
    assert schema.LNG_COL in out and schema.LAT_COL in out and schema.SIGUNGU_CODE_COL in out
    # passthrough
    for c in [schema.NAME_COL, schema.STATUS_COL, schema.DETAIL_STATUS_COL, schema.BIZTYPE_COL]:
        assert c in out


def test_normalize_then_filter_survives_good_rows():
    raw = pd.read_csv(FIX, dtype=str)
    out = filter_localdata(normalize(raw, RegionResolver(GEOJSON)))
    assert len(out) >= 3
    assert (out["lng"].between(*schema.KOREA_BBOX[::2])).all()
    assert (out["lat"].between(schema.KOREA_BBOX[1], schema.KOREA_BBOX[3])).all()
    # 폐업 / 유흥주점 dropped
    assert "폐업" not in set(raw[raw[schema.NAME_COL].isin(out["name"])][schema.STATUS_COL])
    assert "유흥주점" not in set(out["biztype"])


def test_unresolved_address_row_is_dropped():
    raw = pd.read_csv(FIX, dtype=str)
    out = normalize(raw, RegionResolver(GEOJSON))
    # 단일 토큰 주소("종로구") 행은 normalize 에서 제외된다
    assert "주소불량 식당" not in set(out[schema.NAME_COL])


def test_unresolved_address_rows_are_dropped():
    raw = pd.read_csv(FIX, dtype=str)
    out = normalize(raw, RegionResolver(GEOJSON))
    assert (out[schema.SIGUNGU_CODE_COL] != "").all()   # no blank codes survive


def test_integrated_city_gu_address_resolves_exact():
    raw = pd.read_csv(FIX, dtype=str)
    out = normalize(raw, RegionResolver(GEOJSON))
    code = out.loc[out[schema.NAME_COL] == "창원 성산 국밥", schema.SIGUNGU_CODE_COL].iloc[0]
    assert code == "38112"


def test_field_map_present():
    assert schema.LOCALDATA_API_FIELD_MAP["BPLC_NM"] == schema.NAME_COL
    assert schema.LOCALDATA_API_FIELD_MAP["CRD_INFO_X"] == schema.X_COL
