"""geojson 의 전 시군구 코드로 datalab-visitors.sample.csv 를 결정적으로 생성.
plately-web/scripts/gen-region-gap.mjs 의 demand 로직과 동일한 해시 방식.
실데이터(데이터랩 export)로 교체하면 이 스크립트는 불필요."""
from __future__ import annotations

import csv
import json
from pathlib import Path

GEOJSON = Path(__file__).resolve().parents[2] / "plately-web/public/sigungu.simplified.geojson"
OUT = Path(__file__).resolve().parents[1] / "data/samples/datalab-visitors.sample.csv"

GWANGYEOK = {
    "11": "Seoul", "21": "Busan", "22": "Daegu", "23": "Incheon", "24": "Gwangju",
    "25": "Daejeon", "26": "Ulsan", "29": "Sejong", "31": "Gyeonggi", "32": "Gangwon",
    "33": "Chungbuk", "34": "Chungnam", "35": "Jeonbuk", "36": "Jeonnam",
    "37": "Gyeongbuk", "38": "Gyeongnam", "39": "Jeju",
}


def _hash(s: str) -> float:
    h = 2166136261
    for c in s:
        h ^= ord(c)
        h = (h * 16777619) & 0xFFFFFFFF
    return h / 2**32


def main() -> None:
    geo = json.loads(GEOJSON.read_text(encoding="utf-8"))
    rows = []
    for f in geo["features"]:
        code = str(f["properties"]["code"])
        name = f["properties"]["name"]
        p2 = code[:2]
        metro = p2 in ("11", "21", "39")
        demand = round((55 if metro else 15) + _hash(code + "d") * 45)
        trend = round((_hash(code + "t") - 0.55) * 40)
        rows.append({
            "sigungu_code": code, "sigungu_name": name,
            "gwangyeok": GWANGYEOK.get(p2, "Other"),
            "demand_score": demand, "trend_vs_2019": trend,
        })
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=["sigungu_code", "sigungu_name", "gwangyeok", "demand_score", "trend_vs_2019"])
        w.writeheader()
        w.writerows(rows)
    print(f"wrote {len(rows)} rows → {OUT}")


if __name__ == "__main__":
    main()
