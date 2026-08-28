from pathlib import Path

from pipeline.region_codes import RegionResolver, GWANGYEOK_PREFIX, _city_key

GEOJSON = Path(__file__).resolve().parents[2] / "plately-web/public/sigungu.simplified.geojson"


def test_exact_match():
    r = RegionResolver(GEOJSON)
    assert r.resolve("서울특별시", "용산구") == "11030"


def test_collision_by_gwangyeok():
    r = RegionResolver(GEOJSON)
    assert r.resolve("서울특별시", "중구") != r.resolve("부산광역시", "중구")
    assert r.resolve("서울특별시", "중구") == "11020"


def test_integrated_city_returns_multiple():
    r = RegionResolver(GEOJSON)
    codes = r.resolve_codes("경상남도", "창원시")
    assert len(codes) == 5 and all(c.startswith("38") for c in codes)


def test_sejong_alias():
    r = RegionResolver(GEOJSON)
    assert r.resolve("세종특별자치시", "세종특별자치시") == "29010"


def test_vintage_override_gunwi():
    r = RegionResolver(GEOJSON)
    assert r.resolve("대구광역시", "군위군") == "37310"


def test_unresolvable():
    r = RegionResolver(GEOJSON)
    assert r.resolve("서울특별시", "없는구") is None
    assert r.resolve_codes("없는도", "어딘가") == []


def test_name_and_gwangyeok_en():
    r = RegionResolver(GEOJSON)
    assert r.name_of("11030") == "용산구"
    assert r.gwangyeok_en("11030") == "Seoul"
    assert len(r.all_codes()) == 250


def test_special_forms_in_prefix_map():
    for n in ["강원도", "강원특별자치도", "전라북도", "전북특별자치도", "제주특별자치도"]:
        assert n in GWANGYEOK_PREFIX


def test_resolve_from_address_basic():
    r = RegionResolver(GEOJSON)
    assert r.resolve_from_address("서울특별시 용산구 이태원로 200") == "11030"
    assert r.resolve_from_address("부산광역시 영도구 태종로 30") == r.resolve("부산광역시", "영도구")


def test_resolve_from_address_integrated_city_gu():
    r = RegionResolver(GEOJSON)
    code = r.resolve_from_address("경상남도 창원시 성산구 중앙대로 100")
    assert code in r.resolve_codes("경상남도", "창원시")
    # 일반구 있으면 정확히 그 구
    assert r.name_of(code) == "창원시성산구"


def test_resolve_from_address_ambiguous_integrated_city_without_gu():
    r = RegionResolver(GEOJSON)
    # 통합시인데 주소에 일반구가 없음 → 모호 → None
    assert r.resolve_from_address("경기도 수원시 팔달로 100") is None


def test_resolve_from_address_incheon_2026_overrides():
    r = RegionResolver(GEOJSON)
    assert r.resolve_from_address("인천광역시 영종구 하늘달빛로 100") == "23010"   # 중구
    assert r.resolve_from_address("인천광역시 검단구 완정로 100") == "23080"       # 서구
    assert r.resolve_from_address("인천광역시 제물포구 경인로 100") == "23030"     # 미추홀구


def test_resolve_from_address_sejong():
    r = RegionResolver(GEOJSON)
    assert r.resolve_from_address("세종특별자치시 한누리대로 2130") == "29010"


def test_resolve_from_address_bad():
    r = RegionResolver(GEOJSON)
    assert r.resolve_from_address("") is None
    assert r.resolve_from_address("어디시 무슨구") is None
    assert r.resolve_from_address("서울특별시") is None


def test_city_key_only_touches_integrated_gu():
    assert _city_key("창원시마산합포구") == "창원시"
    assert _city_key("수원시장안구") == "수원시"
    for u in ["용산구", "중구", "서귀포시", "당진시", "군위군"]:
        assert _city_key(u) == u


def test_resolve_from_address_jeonnam_gwangju_combined():
    r = RegionResolver(GEOJSON)
    # 일부 데이터셋의 "전남광주통합특별시" 표기 → 기초명으로 전남/광주 갈라냄
    assert r.resolve_from_address("전남광주통합특별시 여수시 학동 100") == r.resolve("전라남도", "여수시")
    assert r.resolve_from_address("전남광주통합특별시 광산구 명도동 1") == r.resolve("광주광역시", "광산구")
    assert r.resolve_from_address("전남광주통합특별시 동구 금남로 1") == r.resolve("광주광역시", "동구")
