"""Notion 2단계 토큰 리스트. 상호명·메뉴 텍스트 매칭에 쓰인다.
문자열 데이터만 — 로직은 token_match.py."""
from __future__ import annotations

# 배제 신호 (즉시 탈락)
EXCLUDE_PORK = [
    "돼지국밥", "돼지갈비", "삼겹살", "족발", "보쌈", "순대", "갈매기살", "항정살", "수육",
    "제육", "돈까스", "탕수육", "짬뽕", "부대찌개", "감자탕", "뼈해장국", "막창", "곱창",
]

# 메뉴 텍스트 재검사용 — 상호명 배제 토큰 중, 메뉴에선 소고기/무관 요리로도
# 흔해 오탐이 큰 것을 제외. (수육: 곰탕·설렁탕집의 양지·소머리 수육이 흔함)
MENU_EXCLUDE_PORK = [t for t in EXCLUDE_PORK if t != "수육"]

# 포함 신호 (후보로 승격) — 축별
INCLUDE_AXES: dict[str, list[str]] = {
    "seafood": ["횟집", "물회", "생선구이", "조개", "해물", "아구", "대구탕", "초밥", "전복",
                "회센터", "회타운", "활어회", "모둠회", "생선회", "참치회"],
    "chicken": ["삼계탕", "백숙", "닭갈비", "닭한마리", "치킨"],
    "beef": ["한우", "곰탕", "설렁탕", "갈비탕", "육개장"],
    "vegetarian": ["사찰음식", "채식", "비건", "산나물", "나물밥상", "산채", "두부"],
    "muslim": ["케밥", "할랄", "HALAL", "이스탄불", "사마르칸트", "타지마할", "나마스테", "아라비안"],
}

# 메뉴 텍스트 내 주류 키워드 → serves_alcohol
ALCOHOL_MENU = ["소주", "맥주", "막걸리", "생맥주", "하이볼", "와인", "사케", "고량주", "청하"]

# seafood 축 중 "생선"으로 볼 토큰 (containsFish); 나머지는 containsSeafood
FISH_TOKENS = {"생선구이", "아구", "대구탕", "물회",
               "모둠회", "생선회", "참치회", "활어회", "회센터", "회타운"}

# muslim 축 중 이 토큰이 있으면 halalCertified 후보 (그래도 검증 전엔 False)
HALAL_EXPLICIT = {"할랄", "HALAL"}

# 후보 cuisine 라벨 (plately-web ExploreView EXTRA_CUISINE 어휘와 호환)
AXIS_TO_CUISINE = {
    "seafood": "seafood",
    "chicken": "korean-chicken",
    "beef": "korean-beef",
    "vegetarian": "temple",
    "muslim": "halal",
}
