import json
import pandas as pd
from pipeline.tourapi_crosscheck import crosscheck_menus


def _candidates():
    common = {"biztype": "한식", "containsPork": False, "servesAlcohol": "unknown",
              "repMenu": [], "matchedTokens": [], "confidence": "name"}
    return pd.DataFrame([
        {"name": "용산 삼계탕집", "sigungu_code": "11030", "lng": 126.9779, "lat": 37.5384, **common},
        {"name": "종로 순대국밥", "sigungu_code": "11010", "lng": 126.98, "lat": 37.57, **common},
        {"name": "마포 두부집", "sigungu_code": "11440", "lng": 126.91, "lat": 37.55, **common},
    ])


def _write_fixtures(tmp_path):
    (tmp_path / "c1.json").write_text(json.dumps(
        {"title": "용산 삼계탕집", "firstmenu": "삼계탕, 전복삼계탕", "treatmenu": "삼계탕/닭죽/맥주"},
        ensure_ascii=False), encoding="utf-8")
    (tmp_path / "c2.json").write_text(json.dumps(
        {"title": "종로 순대국밥", "firstmenu": "순대국밥", "treatmenu": "순대국밥, 모듬순대"},
        ensure_ascii=False), encoding="utf-8")
    return tmp_path


def test_menu_text_becomes_repmenu(tmp_path):
    out = crosscheck_menus(_candidates(), _write_fixtures(tmp_path)).set_index("name")
    assert "삼계탕" in out.loc["용산 삼계탕집", "repMenu"]


def test_alcohol_keyword_in_menu_sets_serves_alcohol_true(tmp_path):
    out = crosscheck_menus(_candidates(), _write_fixtures(tmp_path)).set_index("name")
    assert out.loc["용산 삼계탕집", "servesAlcohol"] is True


def test_pork_menu_reexcludes_candidate(tmp_path):
    out = crosscheck_menus(_candidates(), _write_fixtures(tmp_path)).set_index("name")
    assert "종로 순대국밥" not in out.index


def test_beef_suyuk_in_menu_does_not_reexclude(tmp_path):
    d = _write_fixtures(tmp_path)
    (d / "c3.json").write_text(json.dumps(
        {"title": "마포 두부집", "firstmenu": "두부전골", "treatmenu": "두부전골, 수육"},
        ensure_ascii=False), encoding="utf-8")
    out = crosscheck_menus(_candidates(), d).set_index("name")
    assert "마포 두부집" in out.index


def test_matched_row_confidence_becomes_menu(tmp_path):
    out = crosscheck_menus(_candidates(), _write_fixtures(tmp_path)).set_index("name")
    assert out.loc["용산 삼계탕집", "confidence"] == "menu"


def test_candidate_without_fixture_passes_through_unchanged(tmp_path):
    out = crosscheck_menus(_candidates(), _write_fixtures(tmp_path)).set_index("name")
    assert "마포 두부집" in out.index
    assert out.loc["마포 두부집", "confidence"] == "name"
    assert out.loc["마포 두부집", "servesAlcohol"] == "unknown"


def test_pork_and_alcohol_both_present_row_is_dropped(tmp_path):
    d = tmp_path
    (d / "c1.json").write_text(json.dumps(
        {"title": "용산 삼계탕집", "firstmenu": "삼계탕", "treatmenu": "삼계탕, 족발, 소주"},
        ensure_ascii=False), encoding="utf-8")
    out = crosscheck_menus(_candidates(), d).set_index("name")
    assert "용산 삼계탕집" not in out.index


def test_empty_candidates_returns_empty_frame_not_crash():
    empty = _candidates().iloc[0:0]
    out = crosscheck_menus(empty, "/nonexistent")
    assert len(out) == 0
