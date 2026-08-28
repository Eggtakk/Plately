import json
import pandas as pd
from pipeline.datalab_adapter import load_regional_demand, resolve_matches, GWANGYEOK_PREFIX


def _geojson(tmp_path, feats):
    p = tmp_path / "geo.json"
    p.write_text(json.dumps({"type": "FeatureCollection", "features": [
        {"type": "Feature", "properties": {"code": c, "name": n}, "geometry": None} for c, n in feats
    ]}, ensure_ascii=False), encoding="utf-8")
    return p


def _csv(tmp_path, rows):
    p = tmp_path / "regional.csv"
    lines = ["광역지자체명,기초지자체명,광역지자체 방문자 수,광역지자체 방문자 비율,기초지자체 방문자 수,기초지자체 방문자 비율"]
    for gw, gu, cnt in rows:
        lines.append(f"{gw},{gu},1000000.0,1.0,{cnt},1.0")
    p.write_text("\n".join(lines) + "\n", encoding="utf-8-sig")
    return p


FEATS = [
    ("11020", "중구"), ("11030", "용산구"),      # 서울
    ("21010", "중구"),                            # 부산 중구 (collision)
    ("38110", "창원시성산구"), ("38111", "창원시마산합포구"), ("38112", "창원시진해구"),  # 경남 창원 3구
    ("29010", "세종시"),                          # 세종 (alias)
]


def test_row_per_geojson_feature(tmp_path):
    g = _geojson(tmp_path, FEATS)
    c = _csv(tmp_path, [("서울특별시", "중구", "500"), ("서울특별시", "용산구", "300")])
    out = load_regional_demand(c, g)
    assert len(out) == len(FEATS)
    assert set(out["sigungu_code"]) == {c for c, _ in FEATS}
    assert list(out.columns) == ["sigungu_code", "sigungu_name", "gwangyeok", "demand_score", "trend_vs_2019"]
    assert (out["trend_vs_2019"] == 0).all()


def test_collision_resolved_by_gwangyeok(tmp_path):
    g = _geojson(tmp_path, FEATS)
    c = _csv(tmp_path, [("서울특별시", "중구", "900"), ("부산광역시", "중구", "100")])
    _, unmatched = resolve_matches(c, g)
    assert unmatched == []
    out = load_regional_demand(c, g).set_index("sigungu_code")
    assert out.loc["11020", "demand_score"] > out.loc["21010", "demand_score"]  # 서울 중구 > 부산 중구


def test_integrated_city_split_evenly(tmp_path):
    g = _geojson(tmp_path, FEATS)
    c = _csv(tmp_path, [("경상남도", "창원시", "300")])
    codes, unmatched = resolve_matches(c, g)
    assert unmatched == []
    assert codes["38110"] == 100.0 and codes["38111"] == 100.0 and codes["38112"] == 100.0


def test_sejong_alias(tmp_path):
    g = _geojson(tmp_path, FEATS)
    c = _csv(tmp_path, [("세종특별자치시", "세종특별자치시", "700")])
    codes, unmatched = resolve_matches(c, g)
    assert unmatched == [] and codes["29010"] == 700.0


def test_unmatched_is_reported_and_scored_zero(tmp_path):
    g = _geojson(tmp_path, FEATS)
    c = _csv(tmp_path, [("서울특별시", "없는구", "500"), ("서울특별시", "용산구", "100")])
    codes, unmatched = resolve_matches(c, g)
    assert unmatched == ["서울특별시 없는구"]
    out = load_regional_demand(c, g).set_index("sigungu_code")
    assert out.loc["11020", "demand_score"] == 0   # 중구 no data


def test_demand_score_is_percentile_0_100(tmp_path):
    g = _geojson(tmp_path, FEATS)
    c = _csv(tmp_path, [("서울특별시", "중구", "10"), ("서울특별시", "용산구", "20"),
                        ("경상남도", "창원시", "3000")])
    out = load_regional_demand(c, g)
    assert out["demand_score"].between(0, 100).all()
    assert out["demand_score"].max() == 100


def test_muslim_share_is_monotonic_scale(tmp_path):
    # 상수 곱이므로 순위 불변 — demand_score 동일해야 함
    g = _geojson(tmp_path, FEATS)
    c = _csv(tmp_path, [("서울특별시", "중구", "10"), ("서울특별시", "용산구", "50"),
                        ("경상남도", "창원시", "300")])
    a = load_regional_demand(c, g, muslim_share=1.0).set_index("sigungu_code")["demand_score"]
    b = load_regional_demand(c, g, muslim_share=0.06).set_index("sigungu_code")["demand_score"]
    assert a.to_dict() == b.to_dict()


def test_gwangyeok_prefix_covers_special_forms():
    for name in ["강원도", "강원특별자치도", "전라북도", "전북특별자치도", "제주특별자치도"]:
        assert name in GWANGYEOK_PREFIX


def test_vintage_override_path(tmp_path):
    # geojson has 군위군 under 경북 prefix 37; CSV lists it under 대구 → only the override resolves it
    feats = [("37310", "군위군"), ("27010", "중구")]  # 대구 중구 present, 군위군 under 37
    g = _geojson(tmp_path, feats)
    c = _csv(tmp_path, [("대구광역시", "군위군", "800")])
    codes, unmatched = resolve_matches(c, g)
    assert unmatched == []
    assert codes["37310"] == 800.0


def test_city_key_only_touches_integrated_gu():
    from pipeline.datalab_adapter import _city_key
    assert _city_key("창원시마산합포구") == "창원시"
    assert _city_key("수원시장안구") == "수원시"
    for unchanged in ["용산구", "중구", "서귀포시", "당진시", "여주시", "동두천시", "군위군", "김포시"]:
        assert _city_key(unchanged) == unchanged


def test_degenerate_raw_emits_all_zero(tmp_path):
    g = _geojson(tmp_path, FEATS)
    # every row has the same visitor count → rank(pct) would otherwise make everything 100
    c = _csv(tmp_path, [("서울특별시", "중구", "0"), ("서울특별시", "용산구", "0")])
    out = load_regional_demand(c, g)
    assert len(out) == len(FEATS)
    assert (out["demand_score"] == 0).all()
