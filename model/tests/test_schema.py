from pipeline import schema


def test_alcohol_business_types_are_a_frozenset_of_known_values():
    assert "유흥주점" in schema.ALCOHOL_BUSINESS_TYPES
    assert "단란주점" in schema.ALCOHOL_BUSINESS_TYPES
    assert isinstance(schema.ALCOHOL_BUSINESS_TYPES, frozenset)


def test_open_status_value():
    assert schema.OPEN_STATUS_NAME == "영업/정상"


def test_tm_to_wgs84_seoul_city_hall_roundtrips_near_expected():
    result = schema.tm_to_wgs84(198_000.0, 451_000.0)
    if result is None:
        import pytest
        pytest.skip("pyproj not installed")
    lng, lat = result
    assert 126.0 < lng < 128.0
    assert 37.0 < lat < 38.5


def test_tm_to_wgs84_handles_missing_pyproj_gracefully(monkeypatch):
    monkeypatch.setattr(schema, "_TRANSFORMER", None, raising=False)
    monkeypatch.setattr(schema, "_pyproj_available", lambda: False)
    assert schema.tm_to_wgs84(1.0, 2.0) is None
