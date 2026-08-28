"""samples(또는 실데이터) → out/{restaurants,region-gap,_meta}.json.
Notion 파이프라인 다이어그램 순서대로 단계별 건수를 찍는다."""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import pandas as pd

from pipeline.localdata_filter import filter_localdata
from pipeline.token_match import match_tokens
from pipeline.tourapi_crosscheck import crosscheck_menus
from pipeline.gap_index import compute_gap
from pipeline.emit import to_restaurants, to_region_gap, build_meta

_HERE = Path(__file__).resolve().parents[1]


def _read_localdata(path: Path) -> pd.DataFrame:
    """실 LOCALDATA (API dump 또는 localdata.go.kr 벌크 CSV). parquet 또는 CSV.
    벌크 CSV 는 대용량(~700MB, 229만행) + cp949 + 39컬럼 → 필요한 컬럼만, 인코딩 자동."""
    from pipeline import schema
    if str(path).endswith(".parquet"):
        return pd.read_parquet(path)
    wanted = {schema.NAME_COL, schema.STATUS_COL, schema.DETAIL_STATUS_COL, schema.BIZTYPE_COL,
              schema.ADDR_COL, schema.ROAD_ADDR_COL, schema.X_COL, schema.Y_COL,
              *schema.LOCALDATA_CSV_HEADER_ALIASES}
    for enc in ("utf-8-sig", "cp949"):
        try:
            head = pd.read_csv(path, dtype=str, nrows=0, encoding=enc)
        except (UnicodeDecodeError, UnicodeError):
            continue
        usecols = [c for c in head.columns if c in wanted]
        return pd.read_csv(path, dtype=str, encoding=enc, usecols=usecols or None)
    raise SystemExit(f"{path}: utf-8/cp949 로 읽을 수 없음")


_DEF_LOCALDATA = _HERE / "data/samples/localdata.sample.csv"
_DEF_TOURAPI = _HERE / "data/samples/tourapi"
_DEF_DATALAB = _HERE / "data/samples/datalab-visitors.sample.csv"
_DEF_OUT = _HERE / "out"
_DEF_GEOJSON = _HERE.parent / "plately-web/public/sigungu.simplified.geojson"


def run(localdata: Path, tourapi_dir: Path, datalab: Path, out_dir: Path,
        *, datalab_format: str = "sample", datalab_country: Path | None = None,
        geojson: Path = _DEF_GEOJSON, localdata_format: str = "sample",
        model_restaurant_csv: Path | None = None) -> None:
    resolver = None
    if localdata_format == "api":
        from pipeline.region_codes import RegionResolver
        from pipeline import localdata_adapter
        resolver = RegionResolver(geojson)
        raw = _read_localdata(localdata)
        raw = localdata_adapter.normalize(raw, resolver)
        supply_source = "localdata-api"
    else:
        raw = pd.read_csv(localdata, dtype=str)
        for c in ["lng", "lat"]:
            raw[c] = pd.to_numeric(raw[c], errors="coerce")
        supply_source = "sample"
    print(f"LOCALDATA 입력            {len(raw):>6}")

    filtered = filter_localdata(raw)
    print(f"  ↓ 영업중 + 비주류        {len(filtered):>6}")

    if model_restaurant_csv:
        from pipeline.region_codes import RegionResolver
        from pipeline import model_restaurant
        resolver = resolver or RegionResolver(geojson)
        hints = model_restaurant.load_menu_hints(model_restaurant_csv, resolver)
        filtered = model_restaurant.annotate(filtered, hints)
        print(f"  · 모범음식점 힌트         {int((filtered['menu_hint'] != '').sum()):>6}")

    candidates = match_tokens(filtered)
    candidates["repMenu"] = pd.Series([[] for _ in range(len(candidates))],
                                      dtype=object, index=candidates.index)
    print(f"  ↓ 토큰 매칭 후보          {len(candidates):>6}")

    checked = crosscheck_menus(candidates, tourapi_dir)
    print(f"  ↓ TourAPI 메뉴 대조       {len(checked):>6}")

    if datalab_format == "regional":
        from pipeline import datalab_adapter, muslim_share
        share = muslim_share.national_muslim_fraction(datalab_country) if datalab_country else 1.0
        demand = datalab_adapter.load_regional_demand(datalab, geojson, muslim_share=share)
        demand_source = "datalab-regional"
        print(f"  · 무슬림권 비중          {share:>6.3f}")
    else:
        demand = pd.read_csv(datalab, dtype={"sigungu_code": str})
        demand_source, share = "sample", None

    gap_df = compute_gap(checked, demand)
    print(f"  → 시군구 갭 지수          {len(gap_df):>6}")

    out_dir.mkdir(parents=True, exist_ok=True)
    region_names = dict(zip(demand["sigungu_code"].astype(str).str.strip(),
                            demand["sigungu_name"].astype(str)))
    restaurants = to_restaurants(checked, region_names=region_names)
    (out_dir / "restaurants.json").write_text(
        json.dumps(restaurants, ensure_ascii=False, indent=2), encoding="utf-8")
    (out_dir / "region-gap.json").write_text(
        json.dumps(to_region_gap(gap_df), ensure_ascii=False, indent=2), encoding="utf-8")
    (out_dir / "_meta.json").write_text(
        json.dumps(build_meta(len(restaurants), len(gap_df),
                              demand_source=demand_source, supply_source=supply_source,
                              muslim_share=share),
                   ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n확인된 포크프리 {len(restaurants)}곳 → {out_dir}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--localdata", type=Path, default=_DEF_LOCALDATA)
    ap.add_argument("--tourapi-dir", type=Path, default=_DEF_TOURAPI)
    ap.add_argument("--datalab", type=Path, default=_DEF_DATALAB)
    ap.add_argument("--out", type=Path, default=_DEF_OUT, dest="out_dir")
    ap.add_argument("--datalab-format", choices=["sample", "regional"], default="sample")
    ap.add_argument("--datalab-country", type=Path, default=None)
    ap.add_argument("--geojson", type=Path, default=_DEF_GEOJSON)
    ap.add_argument("--localdata-format", choices=["sample", "api"], default="sample")
    ap.add_argument("--model-restaurant-csv", type=Path, default=None)
    a = ap.parse_args()
    run(a.localdata, a.tourapi_dir, a.datalab, a.out_dir,
        datalab_format=a.datalab_format, datalab_country=a.datalab_country, geojson=a.geojson,
        localdata_format=a.localdata_format, model_restaurant_csv=a.model_restaurant_csv)


if __name__ == "__main__":
    main()
