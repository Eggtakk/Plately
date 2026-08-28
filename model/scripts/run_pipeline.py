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
_DEF_LOCALDATA = _HERE / "data/samples/localdata.sample.csv"
_DEF_TOURAPI = _HERE / "data/samples/tourapi"
_DEF_DATALAB = _HERE / "data/samples/datalab-visitors.sample.csv"
_DEF_OUT = _HERE / "out"
_DEF_GEOJSON = _HERE.parent / "plately-web/public/sigungu.simplified.geojson"


def run(localdata: Path, tourapi_dir: Path, datalab: Path, out_dir: Path,
        *, datalab_format: str = "sample", datalab_country: Path | None = None,
        geojson: Path = _DEF_GEOJSON) -> None:
    raw = pd.read_csv(localdata, dtype=str)
    for c in ["lng", "lat"]:
        raw[c] = pd.to_numeric(raw[c], errors="coerce")
    print(f"LOCALDATA 입력            {len(raw):>6}")

    filtered = filter_localdata(raw)
    print(f"  ↓ 영업중 + 비주류        {len(filtered):>6}")

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
                              demand_source=demand_source, muslim_share=share),
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
    a = ap.parse_args()
    run(a.localdata, a.tourapi_dir, a.datalab, a.out_dir,
        datalab_format=a.datalab_format, datalab_country=a.datalab_country, geojson=a.geojson)


if __name__ == "__main__":
    main()
