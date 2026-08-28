from scripts.fetch_tourapi import parse_detail_intro, parse_search_first, build_intro_params, build_search_params


def test_build_intro_params_includes_key_and_contentid():
    p = build_intro_params(api_key="KEY", content_id="123")
    assert p["serviceKey"] == "KEY"
    assert p["contentId"] == "123"
    assert p["contentTypeId"] == "39"  # 음식점
    assert p["MobileOS"] and p["MobileApp"] and p["_type"] == "json"


def test_build_search_params_includes_keyword():
    p = build_search_params(api_key="KEY", keyword="행복식당")
    assert p["serviceKey"] == "KEY"
    assert p["keyword"] == "행복식당"
    assert p["contentTypeId"] == "39"


def test_parse_detail_intro_extracts_menu_fields():
    body = {"response": {"body": {"items": {"item": [
        {"contentid": "123", "title": "행복식당", "firstmenu": "비빔밥", "treatmenu": "비빔밥, 된장찌개"}
    ]}}}}
    out = parse_detail_intro(body, title="행복식당")
    assert out == {"contentid": "123", "title": "행복식당", "firstmenu": "비빔밥", "treatmenu": "비빔밥, 된장찌개"}


def test_parse_detail_intro_handles_empty():
    assert parse_detail_intro({"response": {"body": {"items": ""}}}, title="x") is None


def test_parse_detail_intro_handles_single_item_not_in_list():
    body = {"response": {"body": {"items": {"item": {"contentid": "9", "title": "x", "firstmenu": "국밥", "treatmenu": ""}}}}}
    out = parse_detail_intro(body, title="x")
    assert out["contentid"] == "9" and out["firstmenu"] == "국밥"


def test_parse_search_first_returns_contentid_and_coords():
    body = {"response": {"body": {"items": {"item": [
        {"contentid": "555", "title": "행복식당", "mapx": "127.1", "mapy": "37.5"},
        {"contentid": "556", "title": "행복식당 2호점"}]}}}}
    hit = parse_search_first(body)
    assert hit["contentid"] == "555"
    assert hit["mapx"] == "127.1"


def test_parse_search_first_empty():
    assert parse_search_first({"response": {"body": {"items": ""}}}) is None


def test_candidate_name_handles_dict_str_none():
    from scripts.fetch_tourapi import _candidate_name
    assert _candidate_name({"name": {"ko": "가", "en": "b"}}) == "가"
    assert _candidate_name({"name": "다"}) == "다"
    assert _candidate_name({"name": None}) == "" and _candidate_name({}) == ""


def test_items_handles_null_item():
    from scripts.fetch_tourapi import _items
    assert _items({"response": {"body": {"items": {"item": None}}}}) == []
