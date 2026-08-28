from pipeline import tokens


def test_exclude_pork_matches_notion_list():
    for t in ["돼지국밥", "삼겹살", "족발", "보쌈", "순대", "제육", "감자탕", "곱창"]:
        assert t in tokens.EXCLUDE_PORK


def test_include_axes_cover_five_axes():
    assert set(tokens.INCLUDE_AXES) == {"seafood", "chicken", "beef", "vegetarian", "muslim"}


def test_beef_axis_contents():
    assert tokens.INCLUDE_AXES["beef"] == ["한우", "곰탕", "설렁탕", "갈비탕", "육개장"]


def test_menu_exclude_pork_drops_ambiguous_suyuk():
    assert "수육" not in tokens.MENU_EXCLUDE_PORK
    assert "순대" in tokens.MENU_EXCLUDE_PORK


def test_no_token_is_empty_string():
    allt = list(tokens.EXCLUDE_PORK) + list(tokens.ALCOHOL_MENU)
    for axis in tokens.INCLUDE_AXES.values():
        allt += axis
    assert all(t.strip() for t in allt)
