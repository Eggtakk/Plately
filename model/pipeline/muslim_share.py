"""외국인 방문자 거주지(국가) 데이터랩 export × 국가별 무슬림 인구비
→ 전국 무슬림권 방문자 비중(float 0~1).

gap_index 로 넘기는 demand 스케일 상수이자 about 페이지 헤드라인 수치.
비중은 상수 곱이라 시군구 간 순위는 바꾸지 않는다 (datalab_adapter 는 백분위 정규화).
"""
from __future__ import annotations

import csv
from pathlib import Path

# 국가별 무슬림 인구 비율. 출처: Pew Research Center, "The Future of the Global
# Muslim Population" (2011) + CIA World Factbook 갱신치. 데이터랩 거주지(국가)
# export 에 등장하는 국가 전부 커버. 목록에 없는 국가는 0 기여.
MUSLIM_FRACTION: dict[str, float] = {
    "인도네시아": 0.87, "말레이시아": 0.61, "카자흐스탄": 0.70, "튀르키예": 0.99,
    "아랍에미리트": 0.76, "인도": 0.14, "싱가포르": 0.15, "필리핀": 0.06,
    "러시아": 0.10, "태국": 0.05, "중국": 0.017, "프랑스": 0.084, "독일": 0.067,
    "영국": 0.064, "미국": 0.011, "캐나다": 0.034, "호주": 0.032, "일본": 0.002,
    "대만": 0.003, "홍콩": 0.04, "베트남": 0.001, "몽골": 0.03, "멕시코": 0.002,
}

# 데이터랩 "기타" 항목 — 중동·중앙아 다수로 추정되나 보수적으로.
OTHER_MUSLIM_FRACTION = 0.15


def national_muslim_fraction(country_csv: Path) -> float:
    """`국가명, 비율(%)` CSV → sum( 비율/100 * 무슬림인구비 ). "기타" 는 OTHER 사용."""
    total = 0.0
    with Path(country_csv).open(encoding="utf-8-sig") as fh:
        for row in csv.DictReader(fh):
            name = str(row.get("국가명", "")).strip()
            if not name:
                continue
            try:
                pct = float(row.get("비율(%)", 0) or 0)
            except ValueError:
                continue
            frac = OTHER_MUSLIM_FRACTION if name == "기타" else MUSLIM_FRACTION.get(name, 0.0)
            total += (pct / 100.0) * frac
    return round(total, 4)
