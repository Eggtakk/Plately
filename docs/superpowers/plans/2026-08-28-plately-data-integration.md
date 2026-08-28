# Plately 데이터 연동 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Notion 5단계 파이프라인을 독립 Python 패키지 `plately/model/`로 구현하고, 손으로 만든 샘플 입력으로 end-to-end 실행해 나온 JSON을 `plately-web`이 기존 `lib/mockData.ts` 접근자 seam으로 읽게 한다.

**Architecture:** `plately/model/`은 `dajim/model/`과 같은 레이아웃의 standalone Python 패키지 — pipeline 단계별 모듈(`localdata_filter → tokens → token_match → tourapi_crosscheck → gap_index → emit`) + `scripts/run_pipeline.py`. 산출물 `model/out/{restaurants,region-gap,_meta}.json`을 `plately-web/scripts/sync-pipeline-data.mjs`가 형태 검증 후 `public/data/`로 복사한다. 웹 코드는 접근자 시그니처를 유지하므로 화면 변경 0. 실 데이터는 파일 교체만으로 연결.

**Tech Stack:** Python 3 · pandas · pyproj · pytest · requests / Node.js (ESM script) · Next.js 16 · Vitest

---

## 파일 구조

### 신규: `plately/model/`

| 파일 | 책임 |
| --- | --- |
| `model/requirements.txt` | pandas, pyproj, requests, python-dotenv, pytest |
| `model/.env.example` | `DATA_GO_KR_API_KEY` (TourAPI), `LOCALDATA_DIR` |
| `model/.gitignore` | `.venv/ __pycache__/ *.pyc .pytest_cache/ .env` (단 `out/`는 커밋) |
| `model/README.md` | 설치·실행·실데이터 교체 방법 |
| `model/pytest.ini` | `pythonpath = .` |
| `model/pipeline/__init__.py` | 빈 파일 |
| `model/pipeline/schema.py` | LOCALDATA 컬럼 상수 + 업태 제외 목록 + TourAPI 필드 + 좌표 변환(`tm_to_wgs84`) |
| `model/pipeline/tokens.py` | Notion 배제/포함/주류 토큰 리스트 (데이터만) |
| `model/pipeline/localdata_filter.py` | CSV → 영업중·비주류 음식점 DataFrame |
| `model/pipeline/token_match.py` | 상호명(+메뉴텍스트) → 축별 boolean 컬럼 + `matchedTokens` + 후보 승격 |
| `model/pipeline/tourapi_crosscheck.py` | 메뉴 텍스트 대조 → 돈육 재검사 / `servesAlcohol` / `repMenu` / confidence |
| `model/pipeline/gap_index.py` | 후보 공급 vs 데이터랩 수요 → 시군구별 RegionGap 행 (전 시군구 코드) |
| `model/pipeline/emit.py` | DataFrame → `restaurants.json` / `region-gap.json` / `_meta.json` (lib/types.ts 형태) |
| `model/scripts/__init__.py` | 빈 파일 |
| `model/scripts/run_pipeline.py` | samples → `out/*.json`, 단계별 건수 로그 |
| `model/scripts/fetch_tourapi.py` | 실제 공공데이터포털 요청 코드 (이번 세션 미실행, fixture로 테스트) |
| `model/scripts/gen_datalab_sample.py` | geojson 250개 코드 → `datalab-visitors.sample.csv` 결정적 생성 |
| `model/data/samples/localdata.sample.csv` | 손 작성 ~30행 음식점 |
| `model/data/samples/datalab-visitors.sample.csv` | 생성물 (250행) |
| `model/data/samples/tourapi/*.json` | 손 작성 메뉴 fixture 6개 |
| `model/out/{restaurants,region-gap,_meta}.json` | 커밋되는 파이프라인 스냅샷 |
| `model/tests/test_*.py` | 단계별 pytest (7개 파일) |

### 수정: `plately/plately-web/`

| 파일 | 변경 |
| --- | --- |
| `scripts/sync-pipeline-data.mjs` | 신규 — `../model/out/*.json` 검증 + `public/data/`로 복사 |
| `package.json` | `"sync:data"` 스크립트 추가 |
| `public/data/restaurants.json` | 신규 (동기화 산출물, 커밋) |
| `public/data/region-gap.json` | 파이프라인 산출물로 교체 |
| `public/data/_meta.json` | 신규 |
| `lib/mockData.ts` | 인라인 `RESTAURANTS` 배열 삭제 → `restaurants.json` import (파일명·접근자 유지) |
| `lib/mockData.test.ts` | 개수 기반 → 속성 기반 단언으로 완화 |
| `lib/filter.test.ts` | 영향 없음 (자체 mock 사용) — 확인만 |
| `messages/{en,ko,ar,hi}.json` | `about.limitsBody` 문구 "mock" → "sample" |
| `README.md` (web) | "## Data" 섹션 현행화 |
| `../README.md` (repo 루트) | "Data pipeline (planned)" → 구현됨으로 |

---

## Phase 1 — Python 파이프라인

### Task 1: `model/` 패키지 스캐폴드

**Files:**
- Create: `plately/model/requirements.txt`
- Create: `plately/model/.env.example`
- Create: `plately/model/.gitignore`
- Create: `plately/model/pytest.ini`
- Create: `plately/model/pipeline/__init__.py`
- Create: `plately/model/scripts/__init__.py`
- Create: `plately/model/tests/__init__.py`
- Create: `plately/model/README.md`

- [ ] **Step 1: 디렉터리 + 파일 생성**

`plately/model/requirements.txt`:
```
pandas>=2.1
pyproj>=3.6
requests>=2.31
python-dotenv>=1.0
pytest>=7.4
```

`plately/model/.env.example`:
```
# 공공데이터포털(data.go.kr) TourAPI(국문 관광정보 서비스) 인증키.
# https://www.data.go.kr 에서 "한국관광공사_국문 관광정보 서비스" 활용신청 후 발급.
# 이 파일에 실제 값을 넣은 채로 커밋하지 말 것.
DATA_GO_KR_API_KEY=

# LOCALDATA CSV(지방행정 인허가 데이터 - 일반음식점/휴게음식점) 디렉터리.
LOCALDATA_DIR=./data/raw
```

`plately/model/.gitignore`:
```
.venv/
__pycache__/
*.pyc
.pytest_cache/
.env
data/raw/
```
(`out/`는 의도적으로 커밋 — 웹이 Python 없이 빌드 가능해야 함)

`plately/model/pytest.ini`:
```ini
[pytest]
pythonpath = .
testpaths = tests
```

`plately/model/pipeline/__init__.py`, `plately/model/scripts/__init__.py`, `plately/model/tests/__init__.py`: 빈 파일.

`plately/model/README.md`:
```markdown
# model/

Plately 데이터 파이프라인의 standalone Python 구현. `plately-web`(Next.js)과
코드 공유 없음 — 공유하는 것은 `plately-web/lib/types.ts`의 산출물 형태와
시군구 코드 체계뿐. Notion "구현 파이프라인 & 필요 데이터·툴" 문서의
5단계를 그대로 옮긴 것.

## 설치

```bash
cd model
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # TourAPI 실행 시 DATA_GO_KR_API_KEY 채우기
```

## 실행 (샘플 데이터)

```bash
python scripts/gen_datalab_sample.py          # datalab 250행 샘플 생성
python -m scripts.run_pipeline                 # samples → out/*.json
```

산출물: `out/restaurants.json`, `out/region-gap.json`, `out/_meta.json`.
이후 `cd ../plately-web && npm run sync:data`.

## 실데이터로 교체

| 샘플 | 실데이터 |
| --- | --- |
| `data/samples/localdata.sample.csv` | LOCALDATA에서 받은 일반음식점 CSV (`--localdata` 인자) |
| `data/samples/tourapi/*.json` | `scripts/fetch_tourapi.py`로 수집한 메뉴 JSON (`--tourapi-dir`) |
| `data/samples/datalab-visitors.sample.csv` | 데이터랩 무슬림/외국인 방문자 export (`--datalab`) |

컬럼명이 다르면 `pipeline/schema.py` 한 곳만 고치면 된다.

## 테스트

```bash
pytest
```
```

- [ ] **Step 2: 커밋**

```bash
cd /Users/takyerin/claude
git add plately/model/requirements.txt plately/model/.env.example plately/model/.gitignore plately/model/pytest.ini plately/model/pipeline/__init__.py plately/model/scripts/__init__.py plately/model/tests/__init__.py plately/model/README.md
git commit -m "feat(plately/model): package scaffold for the data pipeline

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: `pipeline/schema.py` — 입력 계약 + 좌표 변환

**Files:**
- Create: `plately/model/pipeline/schema.py`
- Test: `plately/model/tests/test_schema.py`

- [ ] **Step 1: 실패 테스트 작성**

`plately/model/tests/test_schema.py`:
```python
from pipeline import schema


def test_alcohol_business_types_are_a_frozenset_of_known_values():
    assert "유흥주점" in schema.ALCOHOL_BUSINESS_TYPES
    assert "단란주점" in schema.ALCOHOL_BUSINESS_TYPES
    assert isinstance(schema.ALCOHOL_BUSINESS_TYPES, frozenset)


def test_open_status_value():
    assert schema.OPEN_STATUS_NAME == "영업/정상"


def test_tm_to_wgs84_seoul_city_hall_roundtrips_near_expected():
    # 서울시청 근처 TM중부원점(EPSG:5174) 좌표 → WGS84
    lng, lat = schema.tm_to_wgs84(198_000.0, 451_000.0)
    assert 126.5 < lng < 127.5
    assert 37.0 < lat < 38.0


def test_tm_to_wgs84_handles_missing_pyproj_gracefully(monkeypatch):
    monkeypatch.setattr(schema, "_TRANSFORMER", None, raising=False)
    monkeypatch.setattr(schema, "_pyproj_available", lambda: False)
    assert schema.tm_to_wgs84(1.0, 2.0) is None
```

- [ ] **Step 2: 실패 확인**

Run: `cd plately/model && pytest tests/test_schema.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'pipeline.schema'`

- [ ] **Step 3: 최소 구현**

`plately/model/pipeline/schema.py`:
```python
"""LOCALDATA / TourAPI 입력 계약. 실제 헤더를 확인하기 전까지는
표준 용어 기반 추정이며, 컬럼명이 다르면 여기만 고치면 된다.

LOCALDATA "일반음식점"/"휴게음식점" CSV 헤더 기준(지방행정인허가데이터개방):
  사업장명, 영업상태명, 상세영업상태명, 업태구분명,
  소재지전체주소, 도로명전체주소, 좌표정보(x), 좌표정보(y)
좌표계는 EPSG:5174 (TM 중부원점, GRS80).
"""
from __future__ import annotations

# --- LOCALDATA 컬럼명 --------------------------------------------------------
NAME_COL = "사업장명"
STATUS_COL = "영업상태명"
DETAIL_STATUS_COL = "상세영업상태명"
BIZTYPE_COL = "업태구분명"
ADDR_COL = "소재지전체주소"
ROAD_ADDR_COL = "도로명전체주소"
X_COL = "좌표정보(x)"
Y_COL = "좌표정보(y)"
# 샘플 CSV는 아래 두 컬럼을 직접 제공(실데이터엔 없음 → 주소 파싱으로 대체)
SIGUNGU_CODE_COL = "sigungu_code"
LNG_COL = "lng"
LAT_COL = "lat"

OPEN_STATUS_NAME = "영업/정상"
CLOSED_DETAIL_STATUSES = frozenset({"폐업", "휴업", "직권말소", "말소", "폐업처리"})

# 주류 전제 업소 → 제외 (Notion 1단계)
ALCOHOL_BUSINESS_TYPES = frozenset(
    {"유흥주점", "단란주점", "감성주점", "소주방", "대포집", "호프", "간이주점", "칵테일바"}
)

# 한반도 대략 bbox (좌표 sanity check)
KOREA_BBOX = (124.0, 33.0, 132.0, 39.5)  # (min_lng, min_lat, max_lng, max_lat)

# --- TourAPI 필드 ----------------------------------------------------------
TOURAPI_TITLE = "title"
TOURAPI_FIRSTMENU = "firstmenu"   # 대표메뉴
TOURAPI_TREATMENU = "treatmenu"   # 취급메뉴
TOURAPI_CONTENTID = "contentid"
TOURAPI_MAPX = "mapx"
TOURAPI_MAPY = "mapy"

# --- 좌표 변환 ------------------------------------------------------------
_TRANSFORMER = None


def _pyproj_available() -> bool:
    try:
        import pyproj  # noqa: F401
        return True
    except ImportError:
        return False


def _transformer():
    global _TRANSFORMER
    if _TRANSFORMER is None:
        from pyproj import Transformer
        _TRANSFORMER = Transformer.from_crs("EPSG:5174", "EPSG:4326", always_xy=True)
    return _TRANSFORMER


def tm_to_wgs84(x: float, y: float) -> tuple[float, float] | None:
    """EPSG:5174 (x, y) → (lng, lat). pyproj 미설치 시 None."""
    if not _pyproj_available():
        return None
    lng, lat = _transformer().transform(x, y)
    return (round(lng, 6), round(lat, 6))
```

- [ ] **Step 4: 통과 확인**

Run: `cd plately/model && pytest tests/test_schema.py -v`
Expected: PASS (4 passed). pyproj 미설치면 `test_tm_to_wgs84_seoul...`는 자동 skip 되도록 — 통과시키려면 Step 3의 해당 테스트를 다음처럼 보완:
```python
def test_tm_to_wgs84_seoul_city_hall_roundtrips_near_expected():
    result = schema.tm_to_wgs84(198_000.0, 451_000.0)
    if result is None:
        import pytest
        pytest.skip("pyproj not installed")
    lng, lat = result
    assert 126.0 < lng < 128.0
    assert 37.0 < lat < 38.5
```

- [ ] **Step 5: 커밋**

```bash
cd /Users/takyerin/claude
git add plately/model/pipeline/schema.py plately/model/tests/test_schema.py
git commit -m "feat(plately/model): schema.py — LOCALDATA/TourAPI column contract + TM→WGS84

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: `pipeline/localdata_filter.py`

**Files:**
- Create: `plately/model/pipeline/localdata_filter.py`
- Test: `plately/model/tests/test_localdata_filter.py`

- [ ] **Step 1: 실패 테스트 작성**

`plately/model/tests/test_localdata_filter.py`:
```python
import pandas as pd
from pipeline.localdata_filter import filter_localdata
from pipeline import schema


def _row(**over):
    base = {
        schema.NAME_COL: "행복식당",
        schema.STATUS_COL: schema.OPEN_STATUS_NAME,
        schema.DETAIL_STATUS_COL: "영업중",
        schema.BIZTYPE_COL: "한식",
        schema.SIGUNGU_CODE_COL: "11010",
        schema.LNG_COL: 126.98,
        schema.LAT_COL: 37.57,
    }
    base.update(over)
    return base


def test_keeps_operating_restaurant():
    df = pd.DataFrame([_row()])
    out = filter_localdata(df)
    assert len(out) == 1


def test_drops_closed():
    df = pd.DataFrame([_row(**{schema.DETAIL_STATUS_COL: "폐업"})])
    assert len(filter_localdata(df)) == 0


def test_drops_non_open_status():
    df = pd.DataFrame([_row(**{schema.STATUS_COL: "폐업"})])
    assert len(filter_localdata(df)) == 0


def test_drops_alcohol_business_type():
    df = pd.DataFrame([_row(**{schema.BIZTYPE_COL: "유흥주점"})])
    assert len(filter_localdata(df)) == 0


def test_drops_out_of_bbox_coords():
    df = pd.DataFrame([_row(**{schema.LNG_COL: 2.35, schema.LAT_COL: 48.85})])  # 파리
    assert len(filter_localdata(df)) == 0


def test_normalizes_columns():
    out = filter_localdata(pd.DataFrame([_row()]))
    assert list(out.columns) == ["name", "sigungu_code", "lng", "lat", "biztype"]
```

- [ ] **Step 2: 실패 확인**

Run: `cd plately/model && pytest tests/test_localdata_filter.py -v`
Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 3: 구현**

`plately/model/pipeline/localdata_filter.py`:
```python
"""Notion 1단계 — 정형 데이터 필터. 영업중 + 비주류 음식점만 남긴다."""
from __future__ import annotations

import pandas as pd

from pipeline import schema


def _in_korea(lng: float, lat: float) -> bool:
    min_lng, min_lat, max_lng, max_lat = schema.KOREA_BBOX
    return min_lng <= lng <= max_lng and min_lat <= lat <= max_lat


def filter_localdata(df: pd.DataFrame) -> pd.DataFrame:
    """LOCALDATA(또는 샘플) DataFrame → 정규화된 후보 DataFrame.

    출력 컬럼: name, sigungu_code, lng, lat, biztype
    """
    out = df.copy()

    out = out[out[schema.STATUS_COL] == schema.OPEN_STATUS_NAME]
    out = out[~out[schema.DETAIL_STATUS_COL].isin(schema.CLOSED_DETAIL_STATUSES)]
    out = out[~out[schema.BIZTYPE_COL].isin(schema.ALCOHOL_BUSINESS_TYPES)]

    out = out.dropna(subset=[schema.LNG_COL, schema.LAT_COL])
    mask = out.apply(lambda r: _in_korea(r[schema.LNG_COL], r[schema.LAT_COL]), axis=1)
    out = out[mask]

    result = pd.DataFrame(
        {
            "name": out[schema.NAME_COL].astype(str).str.strip(),
            "sigungu_code": out[schema.SIGUNGU_CODE_COL].astype(str).str.strip(),
            "lng": out[schema.LNG_COL].astype(float),
            "lat": out[schema.LAT_COL].astype(float),
            "biztype": out[schema.BIZTYPE_COL].astype(str).str.strip(),
        }
    ).reset_index(drop=True)
    return result
```

- [ ] **Step 4: 통과 확인**

Run: `cd plately/model && pytest tests/test_localdata_filter.py -v`
Expected: PASS (6 passed)

- [ ] **Step 5: 커밋**

```bash
cd /Users/takyerin/claude
git add plately/model/pipeline/localdata_filter.py plately/model/tests/test_localdata_filter.py
git commit -m "feat(plately/model): localdata_filter — operating, non-alcohol restaurants

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: `pipeline/tokens.py`

**Files:**
- Create: `plately/model/pipeline/tokens.py`
- Test: `plately/model/tests/test_tokens.py`

- [ ] **Step 1: 실패 테스트 작성**

`plately/model/tests/test_tokens.py`:
```python
from pipeline import tokens


def test_exclude_pork_matches_notion_list():
    for t in ["돼지국밥", "삼겹살", "족발", "보쌈", "순대", "제육", "감자탕", "곱창"]:
        assert t in tokens.EXCLUDE_PORK


def test_include_axes_cover_five_axes():
    assert set(tokens.INCLUDE_AXES) == {"seafood", "chicken", "beef", "vegetarian", "muslim"}


def test_beef_axis_contents():
    assert tokens.INCLUDE_AXES["beef"] == ["한우", "곰탕", "설렁탕", "갈비탕", "육개장"]


def test_no_token_is_empty_string():
    allt = list(tokens.EXCLUDE_PORK) + list(tokens.ALCOHOL_MENU)
    for axis in tokens.INCLUDE_AXES.values():
        allt += axis
    assert all(t.strip() for t in allt)
```

- [ ] **Step 2: 실패 확인**

Run: `cd plately/model && pytest tests/test_tokens.py -v`
Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 3: 구현**

`plately/model/pipeline/tokens.py`:
```python
"""Notion 2단계 토큰 리스트. 상호명·메뉴 텍스트 매칭에 쓰인다.
문자열 데이터만 — 로직은 token_match.py."""
from __future__ import annotations

# 배제 신호 (즉시 탈락)
EXCLUDE_PORK = [
    "돼지국밥", "삼겹살", "족발", "보쌈", "순대", "갈매기살", "항정살", "수육",
    "제육", "돈까스", "탕수육", "짬뽕", "부대찌개", "감자탕", "뼈해장국", "막창", "곱창",
]

# 포함 신호 (후보로 승격) — 축별
INCLUDE_AXES: dict[str, list[str]] = {
    "seafood": ["횟집", "물회", "생선구이", "조개", "해물", "아구", "대구탕", "초밥", "전복", "회"],
    "chicken": ["삼계탕", "백숙", "닭갈비", "닭한마리", "치킨"],
    "beef": ["한우", "곰탕", "설렁탕", "갈비탕", "육개장"],
    "vegetarian": ["사찰음식", "채식", "비건", "산나물", "나물밥상", "산채", "두부"],
    "muslim": ["케밥", "할랄", "HALAL", "이스탄불", "사마르칸트", "타지마할", "나마스테", "아라비안"],
}

# 메뉴 텍스트 내 주류 키워드 → serves_alcohol
ALCOHOL_MENU = ["소주", "맥주", "막걸리", "생맥주", "하이볼", "와인", "사케", "고량주", "청하"]

# seafood 축 중 "생선"으로 볼 토큰 (containsFish); 나머지는 containsSeafood
FISH_TOKENS = {"생선구이", "아구", "대구탕", "회", "물회"}

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
```

- [ ] **Step 4: 통과 확인**

Run: `cd plately/model && pytest tests/test_tokens.py -v`
Expected: PASS (4 passed)

- [ ] **Step 5: 커밋**

```bash
cd /Users/takyerin/claude
git add plately/model/pipeline/tokens.py plately/model/tests/test_tokens.py
git commit -m "feat(plately/model): tokens.py — Notion exclude/include/alcohol token lists

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: `pipeline/token_match.py`

**Files:**
- Create: `plately/model/pipeline/token_match.py`
- Test: `plately/model/tests/test_token_match.py`

- [ ] **Step 1: 실패 테스트 작성**

`plately/model/tests/test_token_match.py`:
```python
import pandas as pd
from pipeline.token_match import match_tokens


def _df(*names):
    return pd.DataFrame(
        {"name": list(names), "sigungu_code": ["11010"] * len(names),
         "lng": [127.0] * len(names), "lat": [37.5] * len(names),
         "biztype": ["한식"] * len(names)}
    )


def test_pork_name_is_dropped_as_candidate():
    out = match_tokens(_df("남대문 돼지국밥", "용산 삼계탕집"))
    assert list(out["name"]) == ["용산 삼계탕집"]


def test_chicken_axis_sets_contains_chicken_true_pork_false():
    out = match_tokens(_df("용산 삼계탕집")).iloc[0]
    assert out["containsChicken"] is True
    assert out["containsPork"] is False
    assert out["containsBeef"] is False


def test_beef_axis():
    out = match_tokens(_df("종로 설렁탕")).iloc[0]
    assert out["containsBeef"] is True
    assert out["cuisine"] == "korean-beef"


def test_seafood_fish_split():
    out = match_tokens(_df("부산 대구탕", "속초 조개구이")).set_index("name")
    assert out.loc["부산 대구탕", "containsFish"] is True
    assert out.loc["속초 조개구이", "containsSeafood"] is True


def test_vegetarian_axis():
    out = match_tokens(_df("인사동 사찰음식")).iloc[0]
    assert out["vegetarianFriendly"] is True
    assert out["cuisine"] == "temple"


def test_serves_alcohol_unknown_from_name_only():
    out = match_tokens(_df("용산 삼계탕집")).iloc[0]
    assert out["servesAlcohol"] == "unknown"


def test_matched_tokens_recorded():
    out = match_tokens(_df("이태원 할랄 케밥")).iloc[0]
    assert set(out["matchedTokens"]) >= {"케밥", "할랄"}
    assert out["confidence"] == "name"


def test_unknown_tristate_fields_default_unknown():
    out = match_tokens(_df("용산 삼계탕집")).iloc[0]
    for f in ["porkDerivedIngredients", "containsGelatin", "nonHalalMeat", "crossContaminationRisk"]:
        assert out[f] == "unknown"


def test_strict_boolean_fields_default_false():
    out = match_tokens(_df("용산 삼계탕집")).iloc[0]
    for f in ["containsEgg", "containsOnionGarlic", "halalCertified"]:
        assert out[f] is False


def test_no_axis_match_is_dropped():
    out = match_tokens(_df("그냥 분식집"))
    assert len(out) == 0
```

- [ ] **Step 2: 실패 확인**

Run: `cd plately/model && pytest tests/test_token_match.py -v`
Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 3: 구현**

`plately/model/pipeline/token_match.py`:
```python
"""Notion 2단계 — 상호명 토큰 매칭. 이진 판정이 아니라 축별 독립 boolean
컬럼을 만든다 (Notion "이진 라벨 → 다차원 속성 태그").

입력: localdata_filter 출력 (name, sigungu_code, lng, lat, biztype)
출력: 위 + RestaurantAttributes 축별 컬럼 + matchedTokens + cuisine + confidence
후보 승격 안 된 행(포크 매칭 or 축 매칭 0)은 제거.
"""
from __future__ import annotations

import pandas as pd

from pipeline import tokens

_UNKNOWN_FIELDS = ["porkDerivedIngredients", "containsGelatin", "nonHalalMeat", "crossContaminationRisk"]


def _found(text: str, needles) -> list[str]:
    up = text.upper()
    return [n for n in needles if n.upper() in up]


def _match_one(name: str) -> dict | None:
    hits = _found(name, tokens.EXCLUDE_PORK)
    contains_pork = len(hits) > 0

    axis_hits: dict[str, list[str]] = {}
    for axis, needles in tokens.INCLUDE_AXES.items():
        found = _found(name, needles)
        if found:
            axis_hits[axis] = found

    if contains_pork or not axis_hits:
        return None  # 후보 미승격

    matched = sorted({t for lst in axis_hits.values() for t in lst})
    seafood_hits = axis_hits.get("seafood", [])
    contains_fish = any(t in tokens.FISH_TOKENS for t in seafood_hits)
    contains_seafood = any(t not in tokens.FISH_TOKENS for t in seafood_hits)

    # 주 cuisine: 매칭된 첫 축 우선순위 (muslim > vegetarian > beef > seafood > chicken)
    for axis in ["muslim", "vegetarian", "beef", "seafood", "chicken"]:
        if axis in axis_hits:
            cuisine = tokens.AXIS_TO_CUISINE[axis]
            break
    else:
        cuisine = "korean"

    row = {
        "containsPork": False,
        "containsBeef": "beef" in axis_hits,
        "containsChicken": "chicken" in axis_hits,
        "containsFish": contains_fish,
        "containsSeafood": contains_seafood,
        "vegetarianFriendly": "vegetarian" in axis_hits,
        "servesAlcohol": "unknown",
        "containsEgg": False,
        "containsOnionGarlic": False,
        "halalCertified": False,  # 검증 전엔 항상 False
        "matchedTokens": matched,
        "cuisine": cuisine,
        "confidence": "name",
    }
    for f in _UNKNOWN_FIELDS:
        row[f] = "unknown"
    return row


def match_tokens(df: pd.DataFrame) -> pd.DataFrame:
    records = []
    for _, r in df.iterrows():
        m = _match_one(str(r["name"]))
        if m is None:
            continue
        records.append({**r.to_dict(), **m})
    if not records:
        return pd.DataFrame(columns=list(df.columns) + ["containsPork"])
    return pd.DataFrame(records).reset_index(drop=True)
```

- [ ] **Step 4: 통과 확인**

Run: `cd plately/model && pytest tests/test_token_match.py -v`
Expected: PASS (10 passed)

- [ ] **Step 5: 커밋**

```bash
cd /Users/takyerin/claude
git add plately/model/pipeline/token_match.py plately/model/tests/test_token_match.py
git commit -m "feat(plately/model): token_match — per-axis boolean tags from restaurant name

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: `pipeline/tourapi_crosscheck.py`

**Files:**
- Create: `plately/model/pipeline/tourapi_crosscheck.py`
- Test: `plately/model/tests/test_tourapi_crosscheck.py`

- [ ] **Step 1: 실패 테스트 작성**

`plately/model/tests/test_tourapi_crosscheck.py`:
```python
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
    # 용산 삼계탕집: 주류 메뉴(맥주) O, 돈육 X
    (tmp_path / "c1.json").write_text(json.dumps(
        {"title": "용산 삼계탕집", "firstmenu": "삼계탕, 전복삼계탕", "treatmenu": "삼계탕/닭죽/맥주"},
        ensure_ascii=False), encoding="utf-8")
    # 종로 순대국밥: 메뉴 텍스트에 "순대" (명백한 돈육) → 재검출 → 탈락
    (tmp_path / "c2.json").write_text(json.dumps(
        {"title": "종로 순대국밥", "firstmenu": "순대국밥", "treatmenu": "순대국밥, 모듬순대"},
        ensure_ascii=False), encoding="utf-8")
    return tmp_path


def test_menu_text_becomes_repmenu(tmp_path):
    out = crosscheck_menus(_candidates(), _write_fixtures(tmp_path)).set_index("name")
    assert "삼계탕" in out.loc["용산 삼계탕집", "repMenu"]


def test_alcohol_keyword_in_menu_sets_serves_alcohol_true(tmp_path):
    out = crosscheck_menus(_candidates(), _write_fixtures(tmp_path)).set_index("name")
    assert out.loc["용산 삼계탕집", "servesAlcohol"] is True  # 맥주


def test_pork_menu_reexcludes_candidate(tmp_path):
    out = crosscheck_menus(_candidates(), _write_fixtures(tmp_path)).set_index("name")
    assert "종로 순대국밥" not in out.index  # treatmenu "순대" → containsPork True → 탈락


def test_beef_suyuk_in_menu_does_not_reexclude(tmp_path):
    # "수육" 은 곰탕·설렁탕집에서 소고기(양지·소머리) 수육이 흔함 → 메뉴 재검사 배제 토큰에서 제외
    (tmp_path / "c3.json").write_text(json.dumps(
        {"title": "마포 두부집", "firstmenu": "두부전골", "treatmenu": "두부전골, 수육"},
        ensure_ascii=False), encoding="utf-8")
    out = crosscheck_menus(_candidates(), _write_fixtures(tmp_path)).set_index("name")
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
    (tmp_path / "c1.json").write_text(json.dumps(
        {"title": "용산 삼계탕집", "firstmenu": "삼계탕", "treatmenu": "삼계탕, 족발, 소주"},
        ensure_ascii=False), encoding="utf-8")
    out = crosscheck_menus(_candidates(), tmp_path).set_index("name")
    assert "용산 삼계탕집" not in out.index  # 돈육(족발)이 이기고 행 탈락


def test_empty_candidates_returns_empty_frame_not_crash():
    empty = _candidates().iloc[0:0]
    out = crosscheck_menus(empty, "/nonexistent")
    assert len(out) == 0
```

먼저 `plately/model/pipeline/tokens.py` 에 메뉴 재검사용 돈육 토큰 리스트 추가 (기존 `EXCLUDE_PORK` 바로 아래):
```python
# 메뉴 텍스트 재검사용 — 상호명 배제 토큰 중, 메뉴에선 소고기/무관 요리로도
# 흔해 오탐이 큰 것을 제외. (수육: 곰탕·설렁탕집의 양지·소머리 수육이 흔함)
MENU_EXCLUDE_PORK = [t for t in EXCLUDE_PORK if t != "수육"]
```
`tests/test_tokens.py` 에 한 줄 추가:
```python
def test_menu_exclude_pork_drops_ambiguous_수육():
    assert "수육" not in tokens.MENU_EXCLUDE_PORK
    assert "순대" in tokens.MENU_EXCLUDE_PORK
```

- [ ] **Step 2: 실패 확인**

Run: `cd plately/model && ./.venv/bin/pytest tests/test_tourapi_crosscheck.py -v`
Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 3: 구현**

`plately/model/pipeline/tourapi_crosscheck.py`:
```python
"""Notion 3단계 — TourAPI 메뉴 텍스트 대조. 상호명에서 놓친 돈육/주류를
메뉴 텍스트로 잡고, repMenu 를 채운다.

fixture 디렉터리: contentid.json 파일들. 각 파일은
{title, firstmenu, treatmenu} (TourAPI detailIntro 응답 서브셋).
매칭: title 정확 일치.
TODO(real-data): 실데이터는 title 정확일치로 부족 — 상호명 정규화 + 좌표 근접
매칭 필요. 메뉴 구분자도 `,` `/` `\\n` 외에 `·` `|` `()` `;` 등 확장 필요.
"""
from __future__ import annotations

import json
from pathlib import Path

import pandas as pd

from pipeline import tokens
from pipeline.schema import TOURAPI_TITLE, TOURAPI_FIRSTMENU, TOURAPI_TREATMENU


def _load_fixtures(fixture_dir) -> dict[str, dict]:
    out: dict[str, dict] = {}
    d = Path(fixture_dir)
    if not d.is_dir():
        return out
    for p in sorted(d.glob("*.json")):
        try:
            data = json.loads(p.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            continue  # 깨진 fixture 하나로 파이프라인 전체를 멈추지 않음
        out[str(data.get(TOURAPI_TITLE, "")).strip()] = data
    return out


def _split_menu(text: str) -> list[str]:
    parts = []
    for chunk in str(text).replace("\n", ",").replace("/", ",").split(","):
        c = chunk.strip()
        if c:
            parts.append(c)
    return parts


def _menu_parts(fx: dict) -> list[str]:
    return _split_menu(fx.get(TOURAPI_FIRSTMENU, "")) + _split_menu(fx.get(TOURAPI_TREATMENU, ""))


def crosscheck_menus(candidates: pd.DataFrame, fixture_dir) -> pd.DataFrame:
    fixtures = _load_fixtures(fixture_dir)
    rows = []
    for _, r in candidates.iterrows():
        row = r.to_dict()
        fx = fixtures.get(str(row["name"]).strip())
        if fx:
            parts = _menu_parts(fx)
            joined = " ".join(parts)
            if any(tok in joined for tok in tokens.MENU_EXCLUDE_PORK):
                row["containsPork"] = True
            if any(tok in joined for tok in tokens.ALCOHOL_MENU):
                row["servesAlcohol"] = True
            row["repMenu"] = _split_menu(fx.get(TOURAPI_FIRSTMENU, ""))
            row["confidence"] = "menu"
        rows.append(row)

    if not rows:
        return candidates.iloc[0:0].reset_index(drop=True)

    out = pd.DataFrame(rows)
    out = out.astype({c: object for c in out.columns if c not in ("lng", "lat")})
    out = out[out["containsPork"] != True]  # noqa: E712 — 메뉴에서 돈육 확인된 후보 탈락
    return out.reset_index(drop=True)
```

- [ ] **Step 4: 통과 확인**

Run: `cd plately/model && ./.venv/bin/pytest tests/test_tourapi_crosscheck.py -v`
Expected: PASS (8 passed)

- [ ] **Step 5: 커밋**

```bash
cd /Users/takyerin/claude
git add plately/model/pipeline/tourapi_crosscheck.py plately/model/tests/test_tourapi_crosscheck.py
git commit -m "feat(plately/model): tourapi_crosscheck — menu-text pork/alcohol re-check + repMenu

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: `pipeline/gap_index.py`

**Files:**
- Create: `plately/model/pipeline/gap_index.py`
- Test: `plately/model/tests/test_gap_index.py`

- [ ] **Step 1: 실패 테스트 작성**

`plately/model/tests/test_gap_index.py`:
```python
import pandas as pd
from pipeline.gap_index import compute_gap


def _demand():
    return pd.DataFrame([
        {"sigungu_code": "11030", "sigungu_name": "용산구", "gwangyeok": "Seoul",
         "demand_score": 80, "trend_vs_2019": 12},
        {"sigungu_code": "21040", "sigungu_name": "영도구", "gwangyeok": "Busan",
         "demand_score": 40, "trend_vs_2019": -5},
        {"sigungu_code": "33370", "sigungu_name": "음성군", "gwangyeok": "Chungbuk",
         "demand_score": 20, "trend_vs_2019": 3},
    ])


def _candidates():
    return pd.DataFrame([
        {"sigungu_code": "11030", "name": "a"},
        {"sigungu_code": "11030", "name": "b"},
        {"sigungu_code": "21040", "name": "c"},
    ])


def test_row_per_demand_region():
    out = compute_gap(_candidates(), _demand())
    assert set(out["code"]) == {"11030", "21040", "33370"}


def test_supply_count_from_candidates():
    out = compute_gap(_candidates(), _demand()).set_index("code")
    assert out.loc["11030", "supplyCount"] == 2
    assert out.loc["33370", "supplyCount"] == 0


def test_gap_index_within_0_100():
    out = compute_gap(_candidates(), _demand())
    assert out["gapIndex"].between(0, 100).all()


def test_high_demand_no_supply_has_high_gap():
    demand = _demand()
    out = compute_gap(pd.DataFrame(columns=["sigungu_code", "name"]), demand).set_index("code")
    assert out.loc["11030", "gapIndex"] > out.loc["33370", "gapIndex"]


def test_name_shape_matches_localizedname():
    out = compute_gap(_candidates(), _demand()).iloc[0]
    assert set(out["name"]) == {"en", "ko", "ar", "hi"}
```

- [ ] **Step 2: 실패 확인**

Run: `cd plately/model && pytest tests/test_gap_index.py -v`
Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 3: 구현**

`plately/model/pipeline/gap_index.py`:
```python
"""Notion 5단계 — 수요-공급 갭 지수. 데이터랩 방문자 수요 vs 후보 공급.
공식은 plately-web/scripts/gen-region-gap.mjs 에서 이식."""
from __future__ import annotations

import pandas as pd


def _clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def compute_gap(candidates: pd.DataFrame, demand: pd.DataFrame) -> pd.DataFrame:
    supply = candidates.groupby("sigungu_code").size() if len(candidates) else pd.Series(dtype=int)

    rows = []
    for _, d in demand.iterrows():
        code = str(d["sigungu_code"]).strip()
        demand_score = int(d["demand_score"])
        supply_count = int(supply.get(code, 0))
        relief = supply_count / max(1, demand_score / 10)
        gap_index = int(round(_clamp(demand_score - relief * 30, 0, 100)))
        ko = str(d["sigungu_name"])
        rows.append({
            "code": code,
            "name": {"en": ko, "ko": ko, "ar": ko, "hi": ko},
            "gwangyeok": str(d["gwangyeok"]),
            "demandScore": demand_score,
            "supplyCount": supply_count,
            "gapIndex": gap_index,
            "trendVs2019": int(d["trend_vs_2019"]),
        })
    return pd.DataFrame(rows).reset_index(drop=True)
```

- [ ] **Step 4: 통과 확인**

Run: `cd plately/model && pytest tests/test_gap_index.py -v`
Expected: PASS (5 passed)

- [ ] **Step 5: 커밋**

```bash
cd /Users/takyerin/claude
git add plately/model/pipeline/gap_index.py plately/model/tests/test_gap_index.py
git commit -m "feat(plately/model): gap_index — per-시군구 demand vs supply gap index

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 8: `pipeline/emit.py` — 출력 계약 + 스키마 테스트

**Files:**
- Create: `plately/model/pipeline/emit.py`
- Test: `plately/model/tests/test_emit.py`

- [ ] **Step 1: 실패 테스트 작성**

`plately/model/tests/test_emit.py`:
```python
import pandas as pd
from pipeline.emit import to_restaurants, to_region_gap, build_meta

_ATTR_KEYS = {
    "containsPork", "servesAlcohol", "containsBeef", "vegetarianFriendly",
    "containsChicken", "containsFish", "containsSeafood", "containsEgg",
    "containsOnionGarlic", "porkDerivedIngredients", "containsGelatin",
    "nonHalalMeat", "halalCertified", "crossContaminationRisk",
}


def _candidate_row():
    return {
        "name": "용산 삼계탕집", "sigungu_code": "11030", "lng": 126.9779, "lat": 37.5384,
        "biztype": "한식", "cuisine": "korean-chicken",
        "containsPork": False, "containsBeef": False, "containsChicken": True,
        "containsFish": False, "containsSeafood": False, "vegetarianFriendly": False,
        "servesAlcohol": "unknown", "containsEgg": False, "containsOnionGarlic": False,
        "halalCertified": False, "porkDerivedIngredients": "unknown",
        "containsGelatin": "unknown", "nonHalalMeat": "unknown",
        "crossContaminationRisk": "unknown",
        "matchedTokens": ["삼계탕"], "repMenu": ["삼계탕"], "confidence": "name",
    }


def test_restaurant_shape():
    out = to_restaurants(pd.DataFrame([_candidate_row()]))
    r = out[0]
    assert set(r) == {"id", "name", "area", "sigunguCode", "coords", "cuisine",
                      "attributes", "confidence", "matchedTokens", "repMenu"}
    assert set(r["attributes"]) == _ATTR_KEYS
    assert r["coords"] == [126.9779, 37.5384]
    assert set(r["name"]) == {"en", "ko", "ar", "hi"}


def test_restaurant_id_is_deterministic_and_unique():
    df = pd.DataFrame([_candidate_row(), {**_candidate_row(), "name": "다른집"}])
    ids = [r["id"] for r in to_restaurants(df)]
    assert len(set(ids)) == 2
    assert to_restaurants(df)[0]["id"] == to_restaurants(df)[0]["id"]


def test_phone_verified_passthrough():
    row = {**_candidate_row(), "phoneVerifiedOn": "2026-03-14", "confidence": "phone"}
    out = to_restaurants(pd.DataFrame([row]))[0]
    assert out["phoneVerifiedOn"] == "2026-03-14"


def test_region_gap_passthrough():
    gap_df = pd.DataFrame([{
        "code": "11030", "name": {"en": "용산구", "ko": "용산구", "ar": "용산구", "hi": "용산구"},
        "gwangyeok": "Seoul", "demandScore": 70, "supplyCount": 2, "gapIndex": 40, "trendVs2019": 5,
    }])
    out = to_region_gap(gap_df)
    assert out[0]["code"] == "11030"
    assert set(out[0]) == {"code", "name", "gwangyeok", "demandScore", "supplyCount", "gapIndex", "trendVs2019"}


def test_meta_marks_sample():
    m = build_meta(restaurants=10, regions=250)
    assert m["sampleData"] is True
    assert m["restaurants"] == 10 and m["regions"] == 250
    assert "generatedAt" in m
```

- [ ] **Step 2: 실패 확인**

Run: `cd plately/model && pytest tests/test_emit.py -v`
Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 3: 구현**

`plately/model/pipeline/emit.py`:
```python
"""DataFrame → plately-web/lib/types.ts 형태의 dict/list.
이 파일이 Python ↔ TS 인터페이스 유일 접점. test_emit.py 가 키/타입을 고정한다."""
from __future__ import annotations

import datetime as _dt
import hashlib
import re

import pandas as pd

_ATTR_FIELDS = [
    "containsPork", "servesAlcohol", "containsBeef", "vegetarianFriendly",
    "containsChicken", "containsFish", "containsSeafood", "containsEgg",
    "containsOnionGarlic", "porkDerivedIngredients", "containsGelatin",
    "nonHalalMeat", "halalCertified", "crossContaminationRisk",
]

_GWANGYEOK_KO = {
    "Seoul": "서울", "Busan": "부산", "Daegu": "대구", "Incheon": "인천",
    "Gwangju": "광주", "Daejeon": "대전", "Ulsan": "울산", "Sejong": "세종",
    "Gyeonggi": "경기", "Gangwon": "강원", "Chungbuk": "충북", "Chungnam": "충남",
    "Jeonbuk": "전북", "Jeonnam": "전남", "Gyeongbuk": "경북", "Gyeongnam": "경남",
    "Jeju": "제주", "Other": "기타",
}


def _slug(name: str) -> str:
    h = hashlib.sha1(name.encode("utf-8")).hexdigest()[:8]
    ascii_part = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return f"{ascii_part}-{h}" if ascii_part else h


def _loc(ko: str) -> dict:
    return {"en": ko, "ko": ko, "ar": ko, "hi": ko}


def to_restaurants(df: pd.DataFrame) -> list[dict]:
    out = []
    for _, r in df.iterrows():
        code = str(r["sigungu_code"]).strip()
        name = str(r["name"]).strip()
        rec = {
            "id": f"r-{code}-{_slug(name)}",
            "name": _loc(name),
            "area": _loc(f"{_GWANGYEOK_KO.get(str(r.get('gwangyeok', 'Other')), '')} {code}".strip()),
            "sigunguCode": code,
            "coords": [round(float(r["lng"]), 6), round(float(r["lat"]), 6)],
            "cuisine": str(r["cuisine"]),
            "attributes": {f: r[f] for f in _ATTR_FIELDS},
            "confidence": str(r["confidence"]),
            "matchedTokens": list(r["matchedTokens"]),
            "repMenu": list(r["repMenu"]) if isinstance(r.get("repMenu"), (list, tuple)) else [],
        }
        if r.get("phoneVerifiedOn"):
            rec["phoneVerifiedOn"] = str(r["phoneVerifiedOn"])
        out.append(rec)
    return out


def to_region_gap(df: pd.DataFrame) -> list[dict]:
    cols = ["code", "name", "gwangyeok", "demandScore", "supplyCount", "gapIndex", "trendVs2019"]
    return [{c: r[c] for c in cols} for _, r in df.iterrows()]


def build_meta(restaurants: int, regions: int) -> dict:
    return {
        "sampleData": True,
        "generatedAt": _dt.datetime.now(_dt.timezone.utc).isoformat(timespec="seconds"),
        "restaurants": restaurants,
        "regions": regions,
        "note": "LOCALDATA/TourAPI/데이터랩 실데이터 연결 전 손 작성 샘플",
    }
```

Step 1 테스트의 `area` 키는 `to_restaurants` 출력에 포함돼야 하므로 테스트의 key set에 `area`가 이미 들어있음 — 구현과 일치.

- [ ] **Step 4: 통과 확인**

Run: `cd plately/model && pytest tests/test_emit.py -v`
Expected: PASS (5 passed)

- [ ] **Step 5: 커밋**

```bash
cd /Users/takyerin/claude
git add plately/model/pipeline/emit.py plately/model/tests/test_emit.py
git commit -m "feat(plately/model): emit.py — DataFrame → restaurants/region-gap/_meta JSON

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 9: 샘플 입력 + `gen_datalab_sample.py`

**Files:**
- Create: `plately/model/scripts/gen_datalab_sample.py`
- Create: `plately/model/data/samples/localdata.sample.csv`
- Create: `plately/model/data/samples/datalab-visitors.sample.csv` (생성물)
- Create: `plately/model/data/samples/tourapi/*.json` (6개)
- Test: `plately/model/tests/test_samples.py`

- [ ] **Step 1: `gen_datalab_sample.py` 작성**

`plately/model/scripts/gen_datalab_sample.py`:
```python
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
```

- [ ] **Step 2: datalab 샘플 생성**

Run: `cd plately/model && python scripts/gen_datalab_sample.py`
Expected: `wrote 250 rows → .../datalab-visitors.sample.csv`

- [ ] **Step 3: `localdata.sample.csv` 손 작성**

`plately/model/data/samples/localdata.sample.csv` — 헤더는 `schema.py` 상수와 정확히 일치. ~30행, 여러 시군구, pork/비pork/주류업태 섞어서. **`getComparisonRegions` 하드코딩 코드 `11030`(용산구)·`21040`(영도구)·`33370`(음성군)에 각각 최소 1개 후보가 남도록** 포함.

**중요 — 모든 `sigungu_code` 값은 반드시 geojson 에 존재해야 함** (`mockData.test.ts` 의 "sigunguCode exists in the geojson" 단언). 아래 CSV 의 코드를 그대로 쓰기 전에 검증:
```bash
cd plately/plately-web && node -e "const g=require('./public/sigungu.simplified.geojson');const s=new Set(g.features.map(f=>f.properties.code));for(const c of ['11010','11020','11030','11230','11440','21040','21050','21090','23010','23310','33040','33370','35011','37020'])console.log(c, s.has(c))"
```
`false` 가 나오는 코드는 같은 2자리 접두를 가진 실제 geojson 코드로 교체(예: `head` 로 features 훑어 확인). datalab 샘플은 geojson 에서 생성되므로 거기 있는 코드는 100% 안전.

```csv
사업장명,영업상태명,상세영업상태명,업태구분명,소재지전체주소,도로명전체주소,좌표정보(x),좌표정보(y),sigungu_code,lng,lat
용산 삼계탕집,영업/정상,영업중,한식,서울특별시 용산구 한강대로,서울특별시 용산구 한강대로 100,,,11030,126.9779,37.5384
이태원 할랄 케밥,영업/정상,영업중,기타 외국식,서울특별시 용산구 이태원로,서울특별시 용산구 이태원로 45,,,11030,126.9946,37.5345
아나톨리아 터키 키친,영업/정상,영업중,기타 외국식,서울특별시 용산구 우사단로,서울특별시 용산구 우사단로 12,,,11030,126.9925,37.5341
용산 한우곰탕,영업/정상,영업중,한식,서울특별시 용산구 백범로,서울특별시 용산구 백범로 8,,,11030,126.9662,37.5389
남대문 돼지국밥,영업/정상,영업중,한식,서울특별시 중구 남대문로,서울특별시 중구 남대문로 3,,,11020,126.9779,37.5601
명동 칼국수,영업/정상,영업중,한식,서울특별시 중구 명동길,서울특별시 중구 명동길 20,,,11020,126.9853,37.5636
종로 설렁탕,영업/정상,영업중,한식,서울특별시 종로구 종로,서울특별시 종로구 종로 51,,,11010,126.9895,37.5704
인사동 사찰음식,영업/정상,영업중,한식,서울특별시 종로구 인사동길,서울특별시 종로구 인사동길 30,,,11010,126.9856,37.5740
종로 삼겹살하우스,영업/정상,영업중,한식,서울특별시 종로구 자하문로,서울특별시 종로구 자하문로 5,,,11010,126.9700,37.5800
강남 초밥,영업/정상,영업중,일식,서울특별시 강남구 강남대로,서울특별시 강남구 강남대로 400,,,11230,127.0276,37.4979
강남 순대국,영업/정상,영업중,한식,서울특별시 강남구 테헤란로,서울특별시 강남구 테헤란로 120,,,11230,127.0330,37.5000
홍대 감성주점 나이트,영업/정상,영업중,감성주점,서울특별시 마포구 어울마당로,서울특별시 마포구 어울마당로 60,,,11440,126.9230,37.5550
마포 물회집,영업/정상,영업중,한식,서울특별시 마포구 월드컵로,서울특별시 마포구 월드컵로 20,,,11440,126.9100,37.5560
부산 영도 회센터,영업/정상,영업중,한식,부산광역시 영도구 태종로,부산광역시 영도구 태종로 100,,,21040,129.0680,35.0790
영도 조개구이,영업/정상,영업중,한식,부산광역시 영도구 절영로,부산광역시 영도구 절영로 30,,,21040,129.0730,35.0850
영도 돼지국밥명가,영업/정상,영업중,한식,부산광역시 영도구 와치로,부산광역시 영도구 와치로 10,,,21040,129.0700,35.0900
부산 서면 닭갈비,영업/정상,영업중,한식,부산광역시 부산진구 중앙대로,부산광역시 부산진구 중앙대로 700,,,21050,129.0590,35.1580
해운대 대구탕,영업/정상,영업중,한식,부산광역시 해운대구 구남로,부산광역시 해운대구 구남로 25,,,21090,129.1600,35.1590
해운대 곱창골목,영업/정상,영업중,한식,부산광역시 해운대구 구남로,부산광역시 해운대구 구남로 27,,,21090,129.1610,35.1592
음성 백숙마을,영업/정상,영업중,한식,충청북도 음성군 음성읍 중앙로,충청북도 음성군 음성읍 중앙로 15,,,33370,127.6900,36.9400
음성 한우타운,영업/정상,영업중,한식,충청북도 음성군 대소면 대금로,충청북도 음성군 대소면 대금로 8,,,33370,127.5700,36.9900
음성 족발보쌈,영업/정상,영업중,한식,충청북도 음성군 금왕읍 금석로,충청북도 음성군 금왕읍 금석로 3,,,33370,127.5900,37.0100
청주 삼계탕,영업/정상,영업중,한식,충청북도 청주시 상당구 상당로,충청북도 청주시 상당구 상당로 55,,,33040,127.4890,36.6360
전주 비빔밥나물집,영업/정상,영업중,한식,전라북도 전주시 완산구 전주객사3길,전라북도 전주시 완산구 전주객사3길 22,,,35011,127.1480,35.8160
전주 콩나물국밥,영업/정상,영업중,한식,전라북도 전주시 완산구 풍남문2길,전라북도 전주시 완산구 풍남문2길 5,,,35011,127.1500,35.8140
경주 쌈밥한정식,영업/정상,영업중,한식,경상북도 경주시 첨성로,경상북도 경주시 첨성로 77,,,37020,129.2090,35.8360
경주 두부마을,영업/정상,영업중,한식,경상북도 경주시 불국로,경상북도 경주시 불국로 340,,,37020,129.3320,35.7900
인천 차이나타운 짬뽕,영업/정상,영업중,중식,인천광역시 중구 차이나타운로,인천광역시 중구 차이나타운로 44,,,23010,126.6180,37.4750
인천 강화 새우젓백반,영업/정상,영업중,한식,인천광역시 강화군 강화읍 강화대로,인천광역시 강화군 강화읍 강화대로 100,,,23310,126.4850,37.7470
파리 비스트로,영업/정상,영업중,양식,서울특별시 용산구 이태원로,서울특별시 용산구 이태원로 55,,,11030,2.3500,48.8500
```
(마지막 "파리 비스트로" 행은 bbox 필터 검증용 — 파이프라인 출력에서 빠져야 함.)

- [ ] **Step 4: TourAPI fixture 7개 작성**

`plately/model/data/samples/tourapi/` 아래 (파일명은 임의 contentid):

`2871234.json`:
```json
{"contentid": "2871234", "title": "용산 삼계탕집", "firstmenu": "삼계탕, 전복삼계탕", "treatmenu": "삼계탕 / 닭죽 / 옻닭"}
```
`2871235.json`:
```json
{"contentid": "2871235", "title": "이태원 할랄 케밥", "firstmenu": "양고기 케밥, 치킨 케밥", "treatmenu": "케밥 / 팔라펠 / 후무스"}
```
`2871236.json`:
```json
{"contentid": "2871236", "title": "용산 한우곰탕", "firstmenu": "한우곰탕", "treatmenu": "곰탕 / 수육 / 소주"}
```
`2871237.json`:
```json
{"contentid": "2871237", "title": "부산 영도 회센터", "firstmenu": "모둠회, 물회", "treatmenu": "회 / 매운탕 / 소주 / 맥주"}
```
`2871238.json`:
```json
{"contentid": "2871238", "title": "음성 백숙마을", "firstmenu": "토종닭 백숙", "treatmenu": "백숙 / 닭죽 / 도토리묵"}
```
`2871239.json`:
```json
{"contentid": "2871239", "title": "인사동 사찰음식", "firstmenu": "사찰정식", "treatmenu": "나물반찬 / 연잎밥 / 버섯전골"}
```
`2871240.json`:
```json
{"contentid": "2871240", "title": "강남 초밥", "firstmenu": "모둠초밥", "treatmenu": "초밥 / 우동 / 돈까스"}
```

주의(의도된 케이스):
- `강남 초밥`: 상호명은 seafood 축 통과하지만 treatmenu 에 `돈까스`(명백한 돈육) → 3단계 `containsPork=True` → 탈락. "상호명으론 못 잡는 숨은 돈육을 TourAPI 가 잡는" 시연.
- `용산 한우곰탕`: treatmenu 에 `수육` 있지만 이건 소고기 수육이 흔해 `MENU_EXCLUDE_PORK` 에서 제외됨 → 탈락 안 함. `소주` → `servesAlcohol=True` 로만 표시.
- `부산 영도 회센터`: 주류 메뉴 → `servesAlcohol=True`.

- [ ] **Step 5: 샘플 검증 테스트**

`plately/model/tests/test_samples.py`:
```python
import csv
import json
from pathlib import Path

SAMPLES = Path(__file__).resolve().parents[1] / "data/samples"


def test_localdata_sample_header_matches_schema():
    from pipeline import schema
    with (SAMPLES / "localdata.sample.csv").open(encoding="utf-8") as fh:
        header = next(csv.reader(fh))
    for col in [schema.NAME_COL, schema.STATUS_COL, schema.DETAIL_STATUS_COL,
                schema.BIZTYPE_COL, schema.SIGUNGU_CODE_COL, schema.LNG_COL, schema.LAT_COL]:
        assert col in header


def test_datalab_sample_has_250_rows():
    with (SAMPLES / "datalab-visitors.sample.csv").open(encoding="utf-8") as fh:
        rows = list(csv.DictReader(fh))
    assert len(rows) == 250
    assert {"sigungu_code", "sigungu_name", "gwangyeok", "demand_score", "trend_vs_2019"} == set(rows[0])


def test_comparison_region_codes_present_in_datalab():
    with (SAMPLES / "datalab-visitors.sample.csv").open(encoding="utf-8") as fh:
        codes = {r["sigungu_code"] for r in csv.DictReader(fh)}
    assert {"11030", "21040", "33370"} <= codes


def test_tourapi_fixtures_are_valid_json_with_title():
    for p in (SAMPLES / "tourapi").glob("*.json"):
        d = json.loads(p.read_text(encoding="utf-8"))
        assert d["title"] and "firstmenu" in d
```

- [ ] **Step 6: 통과 확인**

Run: `cd plately/model && pytest tests/test_samples.py -v`
Expected: PASS (4 passed)

- [ ] **Step 7: 커밋**

```bash
cd /Users/takyerin/claude
git add plately/model/scripts/gen_datalab_sample.py plately/model/data/samples/ plately/model/tests/test_samples.py
git commit -m "feat(plately/model): hand-authored sample inputs + datalab sample generator

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 10: `scripts/run_pipeline.py` + 커밋되는 `out/` 스냅샷

**Files:**
- Create: `plately/model/scripts/run_pipeline.py`
- Test: `plately/model/tests/test_run_pipeline.py`
- Create: `plately/model/out/{restaurants,region-gap,_meta}.json` (실행 산출물)

- [ ] **Step 1: 실패 테스트 작성**

`plately/model/tests/test_run_pipeline.py`:
```python
import json
from pathlib import Path
from scripts.run_pipeline import run

SAMPLES = Path(__file__).resolve().parents[1] / "data/samples"


def test_run_produces_three_files(tmp_path):
    run(
        localdata=SAMPLES / "localdata.sample.csv",
        tourapi_dir=SAMPLES / "tourapi",
        datalab=SAMPLES / "datalab-visitors.sample.csv",
        out_dir=tmp_path,
    )
    for f in ["restaurants.json", "region-gap.json", "_meta.json"]:
        assert (tmp_path / f).exists()


def test_region_gap_has_250_rows(tmp_path):
    run(localdata=SAMPLES / "localdata.sample.csv", tourapi_dir=SAMPLES / "tourapi",
        datalab=SAMPLES / "datalab-visitors.sample.csv", out_dir=tmp_path)
    gap = json.loads((tmp_path / "region-gap.json").read_text())
    assert len(gap) == 250


def test_pork_restaurants_excluded(tmp_path):
    run(localdata=SAMPLES / "localdata.sample.csv", tourapi_dir=SAMPLES / "tourapi",
        datalab=SAMPLES / "datalab-visitors.sample.csv", out_dir=tmp_path)
    rs = json.loads((tmp_path / "restaurants.json").read_text())
    names = {r["name"]["ko"] for r in rs}
    assert "남대문 돼지국밥" not in names       # 상호명 토큰
    assert "종로 삼겹살하우스" not in names     # 상호명 토큰
    assert "강남 초밥" not in names             # TourAPI treatmenu "돈까스" 재검사로 탈락
    assert "파리 비스트로" not in names         # bbox
    assert "용산 삼계탕집" in names
    assert "용산 한우곰탕" in names             # "수육"은 소고기로 흔해 탈락 안 함 (MENU_EXCLUDE_PORK)


def test_comparison_regions_have_supply(tmp_path):
    run(localdata=SAMPLES / "localdata.sample.csv", tourapi_dir=SAMPLES / "tourapi",
        datalab=SAMPLES / "datalab-visitors.sample.csv", out_dir=tmp_path)
    gap = {g["code"]: g for g in json.loads((tmp_path / "region-gap.json").read_text())}
    for code in ["11030", "21040", "33370"]:
        assert gap[code]["supplyCount"] >= 1


def test_all_restaurants_have_valid_confidence(tmp_path):
    run(localdata=SAMPLES / "localdata.sample.csv", tourapi_dir=SAMPLES / "tourapi",
        datalab=SAMPLES / "datalab-visitors.sample.csv", out_dir=tmp_path)
    rs = json.loads((tmp_path / "restaurants.json").read_text())
    assert all(r["confidence"] in {"name", "menu", "phone"} for r in rs)
```

- [ ] **Step 2: 실패 확인**

Run: `cd plately/model && pytest tests/test_run_pipeline.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'scripts.run_pipeline'`

- [ ] **Step 3: 구현**

`plately/model/scripts/run_pipeline.py`:
```python
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


def run(localdata: Path, tourapi_dir: Path, datalab: Path, out_dir: Path) -> None:
    raw = pd.read_csv(localdata, dtype=str)
    for c in ["lng", "lat"]:
        raw[c] = pd.to_numeric(raw[c], errors="coerce")
    print(f"LOCALDATA 입력            {len(raw):>6}")

    filtered = filter_localdata(raw)
    print(f"  ↓ 영업중 + 비주류        {len(filtered):>6}")

    candidates = match_tokens(filtered)
    candidates["repMenu"] = [[] for _ in range(len(candidates))]
    print(f"  ↓ 토큰 매칭 후보          {len(candidates):>6}")

    checked = crosscheck_menus(candidates, tourapi_dir)
    print(f"  ↓ TourAPI 메뉴 대조       {len(checked):>6}")

    demand = pd.read_csv(datalab, dtype={"sigungu_code": str})
    gap_df = compute_gap(checked, demand)
    print(f"  → 시군구 갭 지수          {len(gap_df):>6}")

    out_dir.mkdir(parents=True, exist_ok=True)
    # 시군구 코드 → 한글 동 이름 (emit 이 area 라벨에 사용)
    region_names = dict(zip(demand["sigungu_code"].astype(str).str.strip(),
                            demand["sigungu_name"].astype(str)))
    restaurants = to_restaurants(checked, region_names=region_names)
    (out_dir / "restaurants.json").write_text(
        json.dumps(restaurants, ensure_ascii=False, indent=2), encoding="utf-8")
    (out_dir / "region-gap.json").write_text(
        json.dumps(to_region_gap(gap_df), ensure_ascii=False, indent=2), encoding="utf-8")
    (out_dir / "_meta.json").write_text(
        json.dumps(build_meta(len(restaurants), len(gap_df)), ensure_ascii=False, indent=2),
        encoding="utf-8")
    print(f"\n확인된 포크프리 {len(restaurants)}곳 → {out_dir}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--localdata", type=Path, default=_DEF_LOCALDATA)
    ap.add_argument("--tourapi-dir", type=Path, default=_DEF_TOURAPI)
    ap.add_argument("--datalab", type=Path, default=_DEF_DATALAB)
    ap.add_argument("--out", type=Path, default=_DEF_OUT, dest="out_dir")
    a = ap.parse_args()
    run(a.localdata, a.tourapi_dir, a.datalab, a.out_dir)


if __name__ == "__main__":
    main()
```

주의: `match_tokens` 출력에 `repMenu` 컬럼이 없으므로 `run` 에서 빈 리스트로 초기화한 뒤 `crosscheck_menus` 가 fixture 있는 행만 채운다. `to_restaurants(checked, region_names=...)` 는 demand 프레임의 `sigungu_code→sigungu_name` 맵을 받아 `area` 라벨(`"서울 용산구"`)을 만들고, 광역은 코드 접두에서 파생한다.

- [ ] **Step 4: 통과 확인**

Run: `cd plately/model && pytest tests/test_run_pipeline.py -v`
Expected: PASS (5 passed)

- [ ] **Step 5: 전체 테스트 + 스냅샷 생성**

Run: `cd plately/model && pytest`
Expected: 모든 테스트 PASS

Run: `cd plately/model && python scripts/gen_datalab_sample.py && python -m scripts.run_pipeline`
Expected: 단계별 건수 출력 + `out/` 에 3개 파일. `restaurants.json` 에 ~15곳.

- [ ] **Step 6: 커밋**

```bash
cd /Users/takyerin/claude
git add plately/model/scripts/run_pipeline.py plately/model/tests/test_run_pipeline.py plately/model/out/
git commit -m "feat(plately/model): run_pipeline orchestrator + committed sample snapshot

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 11: `scripts/fetch_tourapi.py` (실 요청 코드, 미실행)

**Files:**
- Create: `plately/model/scripts/fetch_tourapi.py`
- Test: `plately/model/tests/test_fetch_tourapi.py`

- [ ] **Step 1: 실패 테스트 작성**

`plately/model/tests/test_fetch_tourapi.py`:
```python
import json
from scripts.fetch_tourapi import parse_detail_intro, build_params


def test_build_params_includes_key_and_contentid():
    p = build_params(api_key="KEY", content_id="123")
    assert p["serviceKey"] == "KEY"
    assert p["contentId"] == "123"
    assert p["contentTypeId"] == "39"  # 음식점
    assert p["MobileOS"] and p["MobileApp"]


def test_parse_detail_intro_extracts_menu_fields():
    body = {"response": {"body": {"items": {"item": [
        {"contentid": "123", "title": "행복식당", "firstmenu": "비빔밥", "treatmenu": "비빔밥, 된장찌개"}
    ]}}}}
    out = parse_detail_intro(body, title="행복식당")
    assert out == {"contentid": "123", "title": "행복식당", "firstmenu": "비빔밥", "treatmenu": "비빔밥, 된장찌개"}


def test_parse_detail_intro_handles_empty():
    body = {"response": {"body": {"items": ""}}}
    assert parse_detail_intro(body, title="x") is None
```

- [ ] **Step 2: 실패 확인**

Run: `cd plately/model && pytest tests/test_fetch_tourapi.py -v`
Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 3: 구현**

`plately/model/scripts/fetch_tourapi.py`:
```python
"""TourAPI(국문 관광정보 서비스) detailIntro 로 음식점 대표/취급 메뉴 수집.
이번 세션 미실행 — DATA_GO_KR_API_KEY 발급 후 실데이터 단계에서 사용.

사용:
  python -m scripts.fetch_tourapi --candidates out/restaurants.json --out data/raw/tourapi
"""
from __future__ import annotations

import argparse
import json
import os
import time
from pathlib import Path

import requests
from dotenv import load_dotenv

load_dotenv()

BASE = "https://apis.data.go.kr/B551011/KorService2"
DETAIL_INTRO = f"{BASE}/detailIntro2"
SEARCH_KEYWORD = f"{BASE}/searchKeyword2"


def build_params(api_key: str, content_id: str) -> dict:
    return {
        "serviceKey": api_key,
        "MobileOS": "ETC",
        "MobileApp": "Plately",
        "_type": "json",
        "contentId": content_id,
        "contentTypeId": "39",
    }


def _items(body: dict) -> list[dict]:
    items = body.get("response", {}).get("body", {}).get("items")
    if not items or items == "":
        return []
    item = items.get("item", [])
    return item if isinstance(item, list) else [item]


def parse_detail_intro(body: dict, title: str) -> dict | None:
    for it in _items(body):
        return {
            "contentid": str(it.get("contentid", "")),
            "title": it.get("title", title),
            "firstmenu": it.get("firstmenu", ""),
            "treatmenu": it.get("treatmenu", ""),
        }
    return None


def fetch_one(api_key: str, content_id: str, title: str, session: requests.Session) -> dict | None:
    r = session.get(DETAIL_INTRO, params=build_params(api_key, content_id), timeout=10)
    r.raise_for_status()
    return parse_detail_intro(r.json(), title)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--candidates", type=Path, required=True,
                    help="restaurants.json (각 항목에 contentId 필요) 또는 name 리스트")
    ap.add_argument("--out", type=Path, default=Path("data/raw/tourapi"))
    a = ap.parse_args()

    api_key = os.environ.get("DATA_GO_KR_API_KEY")
    if not api_key:
        raise SystemExit("DATA_GO_KR_API_KEY 미설정 — .env 를 채우세요")

    cands = json.loads(a.candidates.read_text(encoding="utf-8"))
    a.out.mkdir(parents=True, exist_ok=True)
    with requests.Session() as s:
        for c in cands:
            cid = c.get("contentId") or c.get("contentid")
            if not cid:
                continue
            rec = fetch_one(api_key, str(cid), c.get("name", {}).get("ko", ""), s)
            if rec:
                (a.out / f"{cid}.json").write_text(
                    json.dumps(rec, ensure_ascii=False), encoding="utf-8")
            time.sleep(0.2)


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: 통과 확인**

Run: `cd plately/model && pytest tests/test_fetch_tourapi.py -v`
Expected: PASS (3 passed). `requests` 미설치면 `pip install -r requirements.txt` 먼저.

- [ ] **Step 5: 커밋**

```bash
cd /Users/takyerin/claude
git add plately/model/scripts/fetch_tourapi.py plately/model/tests/test_fetch_tourapi.py
git commit -m "feat(plately/model): fetch_tourapi — real detailIntro client (unused this session)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Phase 2 — plately-web 연동

### Task 12: `scripts/sync-pipeline-data.mjs`

**Files:**
- Create: `plately/plately-web/scripts/sync-pipeline-data.mjs`
- Modify: `plately/plately-web/package.json` (scripts에 `sync:data`)
- Test: `plately/plately-web/lib/__tests__/` 아님 — 스크립트 자체 검증은 실행으로

- [ ] **Step 1: 스크립트 작성**

`plately/plately-web/scripts/sync-pipeline-data.mjs`:
```js
// model/out/*.json 을 검증하고 public/data/ 로 복사한다.
// 실패 시 non-zero exit — CI/개발자가 깨진 산출물을 커밋하지 않도록.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, '../../model/out');
const DEST = join(here, '../public/data');

const ATTR_KEYS = [
  'containsPork', 'servesAlcohol', 'containsBeef', 'vegetarianFriendly',
  'containsChicken', 'containsFish', 'containsSeafood', 'containsEgg',
  'containsOnionGarlic', 'porkDerivedIngredients', 'containsGelatin',
  'nonHalalMeat', 'halalCertified', 'crossContaminationRisk',
];
const CONFIDENCE = new Set(['name', 'menu', 'phone']);

function fail(msg) { console.error(`✗ ${msg}`); process.exitCode = 1; throw new Error(msg); }

function readJson(name) {
  const p = join(OUT, name);
  if (!existsSync(p)) fail(`missing ${p} — run: cd model && python -m scripts.run_pipeline`);
  return JSON.parse(readFileSync(p, 'utf8'));
}

function validateRestaurants(list) {
  if (!Array.isArray(list) || list.length === 0) fail('restaurants.json empty');
  const ids = new Set();
  for (const r of list) {
    for (const k of ['id', 'name', 'area', 'sigunguCode', 'coords', 'cuisine', 'attributes', 'confidence', 'matchedTokens', 'repMenu'])
      if (!(k in r)) fail(`restaurant ${r.id ?? '?'} missing ${k}`);
    if (ids.has(r.id)) fail(`duplicate restaurant id ${r.id}`);
    ids.add(r.id);
    if (!r.name.en || !r.name.ko) fail(`restaurant ${r.id} name.en/ko`);
    if (!Array.isArray(r.coords) || r.coords.length !== 2) fail(`restaurant ${r.id} coords`);
    const [lng, lat] = r.coords;
    if (lng < 124 || lng > 132 || lat < 33 || lat > 39.5) fail(`restaurant ${r.id} coords out of Korea bbox`);
    if (!CONFIDENCE.has(r.confidence)) fail(`restaurant ${r.id} bad confidence ${r.confidence}`);
    for (const k of ATTR_KEYS) if (!(k in r.attributes)) fail(`restaurant ${r.id} attr ${k}`);
  }
}

function validateRegionGap(list) {
  if (!Array.isArray(list) || list.length < 220) fail(`region-gap.json has ${list?.length} rows (<220)`);
  for (const g of list) {
    for (const k of ['code', 'name', 'gwangyeok', 'demandScore', 'supplyCount', 'gapIndex', 'trendVs2019'])
      if (!(k in g)) fail(`region ${g.code ?? '?'} missing ${k}`);
    if (g.gapIndex < 0 || g.gapIndex > 100) fail(`region ${g.code} gapIndex ${g.gapIndex}`);
  }
}

const restaurants = readJson('restaurants.json');
const regionGap = readJson('region-gap.json');
const meta = readJson('_meta.json');

validateRestaurants(restaurants);
validateRegionGap(regionGap);

writeFileSync(join(DEST, 'restaurants.json'), JSON.stringify(restaurants, null, 2) + '\n');
writeFileSync(join(DEST, 'region-gap.json'), JSON.stringify(regionGap, null, 2) + '\n');
writeFileSync(join(DEST, '_meta.json'), JSON.stringify(meta, null, 2) + '\n');

console.log(`✓ synced ${restaurants.length} restaurants, ${regionGap.length} regions (sampleData=${meta.sampleData})`);
```

- [ ] **Step 2: `package.json` 스크립트 추가**

`plately/plately-web/package.json` 의 `"scripts"` 에 추가 (`"e2e"` 다음 줄):
```json
    "e2e": "playwright test",
    "sync:data": "node scripts/sync-pipeline-data.mjs"
```

- [ ] **Step 3: 실행 확인**

Run: `cd plately/plately-web && npm run sync:data`
Expected: `✓ synced N restaurants, 250 regions (sampleData=true)` — `public/data/restaurants.json`, `region-gap.json`(교체됨), `_meta.json` 생성.

- [ ] **Step 4: 커밋**

```bash
cd /Users/takyerin/claude
git add plately/plately-web/scripts/sync-pipeline-data.mjs plately/plately-web/package.json plately/plately-web/public/data/
git commit -m "feat(plately-web): sync-pipeline-data script — validate + copy model/out JSON

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 13: `lib/mockData.ts` — 인라인 배열 → JSON import

**Files:**
- Modify: `plately/plately-web/lib/mockData.ts`
- Modify: `plately/plately-web/lib/mockData.test.ts`

- [ ] **Step 1: `mockData.test.ts` 갱신 (실패하도록)**

`plately/plately-web/lib/mockData.test.ts` 전체 교체:
```ts
import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { RESTAURANTS, getRestaurant, getRestaurants, getRegions, getComparisonRegions } from './mockData';

describe('mockData (pipeline sample)', () => {
  it('has restaurants', () => expect(RESTAURANTS.length).toBeGreaterThan(0));
  it('every restaurant has en + ko names', () => {
    for (const r of RESTAURANTS) { expect(r.name.en).toBeTruthy(); expect(r.name.ko).toBeTruthy(); }
  });
  it('every restaurant id is unique', () => {
    expect(new Set(RESTAURANTS.map((r) => r.id)).size).toBe(RESTAURANTS.length);
  });
  it('no restaurant is confirmed pork (pipeline excludes them)', () => {
    for (const r of RESTAURANTS) expect(r.attributes.containsPork).toBe(false);
  });
  it('every restaurant sigunguCode exists in the geojson', () => {
    const geo = JSON.parse(readFileSync('public/sigungu.simplified.geojson', 'utf8')) as {
      features: { properties: { code: string } }[];
    };
    const codes = new Set(geo.features.map((f) => f.properties.code));
    for (const r of RESTAURANTS) expect(codes.has(r.sigunguCode)).toBe(true);
  });
  it('every restaurant has all 14 attribute keys', () => {
    const keys = ['containsPork','servesAlcohol','containsBeef','vegetarianFriendly','containsChicken','containsFish','containsSeafood','containsEgg','containsOnionGarlic','porkDerivedIngredients','containsGelatin','nonHalalMeat','halalCertified','crossContaminationRisk'];
    for (const r of RESTAURANTS) for (const k of keys) expect(r.attributes).toHaveProperty(k);
  });
  it('every restaurant confidence is name|menu|phone', () => {
    for (const r of RESTAURANTS) expect(['name', 'menu', 'phone']).toContain(r.confidence);
  });
  it('getRestaurant returns by id', () => {
    expect(getRestaurant(RESTAURANTS[0].id)?.id).toBe(RESTAURANTS[0].id);
  });
  it('getRestaurants applies a cuisine filter', () => {
    const all = getRestaurants();
    const cuisine = all[0].cuisine;
    expect(getRestaurants({ cuisines: [cuisine] }).every((r) => r.cuisine === cuisine)).toBe(true);
  });
  it('getComparisonRegions returns three distinct regions', () => {
    const [a, b, c] = getComparisonRegions();
    expect(new Set([a.code, b.code, c.code]).size).toBe(3);
  });
  it('has ~250 regions', () => {
    const n = getRegions().length;
    expect(n).toBeGreaterThanOrEqual(220);
    expect(n).toBeLessThanOrEqual(260);
  });
  it('gap index is within 0..100', () => {
    for (const r of getRegions()) { expect(r.gapIndex).toBeGreaterThanOrEqual(0); expect(r.gapIndex).toBeLessThanOrEqual(100); }
  });
});
```
(제거된 단언: "≥24 restaurants", "halal-certified 존재", "vegetarianFriendly 존재" — 샘플 구성에 의존하므로. cuisine 필터 동작으로 대체.)

- [ ] **Step 2: 실패 확인**

Run: `cd plately/plately-web && npm test -- lib/mockData.test.ts`
Expected: FAIL — `getRestaurants` import 없음 / `containsPork` 단언 실패 (아직 옛 mock)

- [ ] **Step 3: `mockData.ts` 상단 교체**

`plately/plately-web/lib/mockData.ts`:
- 1–3행 import 블록을 다음으로:
```ts
import type { Restaurant, RegionGap, RegionGapDetail, RestaurantFilter } from './types';
import regionGapJson from '@/public/data/region-gap.json';
import restaurantsJson from '@/public/data/restaurants.json';
import { applyRestaurantFilter } from './filter';
```
- 5행 `export const RESTAURANTS: Restaurant[] = [` 부터 492행 `];` (인라인 배열 전체)를 다음 한 줄로:
```ts
export const RESTAURANTS: Restaurant[] = restaurantsJson as Restaurant[];
```
- 494행 이하 접근자 5개 (`getRestaurants`/`getRestaurant`/`getRegions`/`getRegion`/`getComparisonRegions`)는 그대로 둔다.

- [ ] **Step 4: 통과 확인**

Run: `cd plately/plately-web && npm test -- lib/mockData.test.ts`
Expected: PASS

Run: `cd plately/plately-web && npm test`
Expected: 전체 PASS (filter.test.ts 는 자체 mock 사용이라 영향 없음; 혹시 `mockData` 를 import 하는 컴포넌트 테스트가 깨지면 해당 테스트의 하드코딩된 id/개수를 `RESTAURANTS[0]` 참조로 교체)

- [ ] **Step 5: 타입체크 + 린트**

Run: `cd plately/plately-web && npx tsc --noEmit && npm run lint`
Expected: 에러 없음. (`resolveJsonModule` 이 켜져 있으므로 JSON import 는 타입 OK. `as Restaurant[]` 캐스트가 구조 불일치를 흡수)

- [ ] **Step 6: 커밋**

```bash
cd /Users/takyerin/claude
git add plately/plately-web/lib/mockData.ts plately/plately-web/lib/mockData.test.ts
git commit -m "feat(plately-web): RESTAURANTS loads from pipeline restaurants.json

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 14: about 카피 + README 현행화

**Files:**
- Modify: `plately/plately-web/messages/en.json`, `ko.json`, `ar.json`, `hi.json` (`about.limitsBody`)
- Modify: `plately/plately-web/README.md` ("## Data" 섹션)
- Modify: `plately/README.md` ("Data pipeline (planned)" 섹션)

- [ ] **Step 1: i18n `about.limitsBody` 4개 로케일 수정**

각 `messages/*.json` 의 `about.limitsBody` 값을 교체 (키 추가/삭제 없음 — `lib/i18n.test.ts` 통과 유지):

`en.json`:
```
"limitsBody": "This prototype runs on hand-authored sample data — real LOCALDATA, TourAPI and Data Lab feeds are not connected yet. Broth and seasoning can contain pork even when a menu name does not say so — always confirm with the restaurant."
```
`ko.json`:
```
"limitsBody": "이 프로토타입은 손으로 만든 샘플 데이터로 동작합니다 — 실제 LOCALDATA·TourAPI·데이터랩 연동은 아직 연결되지 않았습니다. 메뉴 이름에 없어도 육수나 조미료에 돼지 성분이 들어갈 수 있으니 매장에 꼭 확인하세요."
```
`ar.json`:
```
"limitsBody": "يعمل هذا النموذج الأولي على بيانات عينة مُعدّة يدويًا — لم يتم بعد ربط بيانات LOCALDATA وTourAPI وData Lab الحقيقية. قد يحتوي المرق والتوابل على لحم الخنزير حتى لو لم يُذكر ذلك في اسم الطبق — تأكّد دائمًا من المطعم."
```
`hi.json`:
```
"limitsBody": "यह प्रोटोटाइप हाथ से बनाए गए नमूना डेटा पर चलता है — असली LOCALDATA, TourAPI और Data Lab फ़ीड अभी नहीं जुड़े हैं। मेन्यू के नाम में न लिखा हो तब भी शोरबे और मसालों में सूअर का मांस हो सकता है — हमेशा रेस्तरां से पुष्टि करें।"
```

- [ ] **Step 2: i18n 테스트 확인**

Run: `cd plately/plately-web && npm test -- lib/i18n.test.ts`
Expected: PASS (키 parity 유지)

- [ ] **Step 3: `plately-web/README.md` "## Data" 섹션 교체**

기존 "## Data" 섹션 본문을:
```markdown
## Data

Restaurants and the 시군구 gap dataset now come from the **Python pipeline in
[`../model/`](../model)** — Notion's 5-stage flow (LOCALDATA filter → name-token
matching → TourAPI menu cross-check → phone verification → demand/supply gap
index). The pipeline currently runs on hand-authored sample inputs
(`model/data/samples/`); `model/out/_meta.json` carries `sampleData: true`.

`lib/mockData.ts` reads `public/data/restaurants.json` + `public/data/region-gap.json`
(both produced by `npm run sync:data` from `model/out/`). The accessor seam —
`getRestaurants` / `getRestaurant` / `getRegions` / `getRegion` / `getComparisonRegions` —
is unchanged, so screen code never sees the swap.

### Regenerating data

```bash
cd ../model && python scripts/gen_datalab_sample.py && python -m scripts.run_pipeline
cd ../plately-web && npm run sync:data
```

`bash scripts/build-geojson.sh` still re-downloads + simplifies the 시군구 GeoJSON.
`scripts/gen-region-gap.mjs` is superseded by the pipeline and kept only for reference.
```

- [ ] **Step 4: 루트 `plately/README.md` "Data pipeline (planned)" 교체**

```markdown
## Data pipeline — [`model/`](./model)

The Python pipeline implementing Notion's 5-stage flow (LOCALDATA filtering →
name-token matching → TourAPI menu cross-check → phone-verification checklist →
per-시군구 gap index against 데이터랩 demand). Mirrors the `dajim/` layout
(`model/` + `docs/`). Runs on hand-authored sample inputs today; real
LOCALDATA / TourAPI / 데이터랩 exports slot in by file replacement
(`--localdata` / `--tourapi-dir` / `--datalab`). Output JSON feeds `plately-web`
via `npm run sync:data`.
```

- [ ] **Step 5: stale e2e fixture 갱신 (데이터 스왑 회귀)**

`tests/e2e/a11y.spec.ts` 와 `tests/e2e/smoke.spec.ts` 가 하드코딩한 `/en/explore/r-yongsan-samgyetang` 는 새 파이프라인 id(`r-11030-<hash>`)로 바뀌어 404. 동적으로 해석:

`tests/e2e/a11y.spec.ts` — 상단에 `import restaurants from '../../public/data/restaurants.json';` 추가, `routes` 배열의 `'/en/explore/r-yongsan-samgyetang'` 를 `` `/en/explore/${restaurants[0].id}` `` 로 교체.

`tests/e2e/smoke.spec.ts` — "restaurant detail shows a location map" 테스트를 리스트에서 진입하도록:
```ts
test('restaurant detail shows a location map', async ({ page }) => {
  await page.goto('/en/explore');
  await page.locator('a[href*="/explore/"]').first().click();
  await expect(page).toHaveURL(/\/explore\/[^/]+$/);
  await expect(page.locator('[role="application"]')).toBeVisible();
});
```
(`/Samgyetang/` heading 단언 제거 — 파이프라인 이름은 한글.)

`RestaurantCard` 가 실제로 `<a href=".../explore/{id}">` 를 쓰는지 확인하고 셀렉터를 맞출 것 (`components/explore/RestaurantCard.tsx`).

- [ ] **Step 6: e2e 확인 (선택 — 느림)**

Run: `cd plately/plately-web && npm run e2e -- smoke.spec.ts`
Expected: PASS. 시간 없으면 Task 15 preview 검증으로 갈음.

- [ ] **Step 7: 커밋**

```bash
cd /Users/takyerin/claude
git add plately/plately-web/messages/ plately/plately-web/README.md plately/README.md plately/plately-web/tests/e2e/
git commit -m "docs(plately): about copy + READMEs reflect the real pipeline seam; fix stale e2e fixtures

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 15: end-to-end 검증 (dev 서버 + 스크린샷)

**Files:** 없음 (검증 전용)

- [ ] **Step 1: 전체 테스트 스위트**

Run: `cd plately/model && pytest`
Expected: 모든 pytest PASS

Run: `cd plately/plately-web && npm test && npx tsc --noEmit && npm run lint`
Expected: 모두 PASS

- [ ] **Step 2: dev 서버 기동**

preview_start `{name: "plately-web"}` (없으면 `.claude/launch.json` 에 `{name:"plately-web", runtimeExecutable:"npm", runtimeArgs:["run","dev"], port:3000}` 생성).

- [ ] **Step 3: Explore 렌더 확인**

1. `http://localhost:3000` → `/en/login` 랜딩
2. 로그인 폼: 아무 이메일+비번 or guest → onboarding → profile "Muslim" → tier "Pork & alcohol free" → `/explore`
3. read_console_messages / preview_logs 로 에러 없음 확인
4. read_page 로 restaurant list 가 파이프라인 데이터(예: "용산 삼계탕집", "이태원 할랄 케밥")를 렌더하는지 확인
5. cuisine 칩 (Seafood / Chicken / Korean cuisine) 클릭 → 리스트 필터링 확인
6. computer screenshot

- [ ] **Step 4: Insight 렌더 확인**

1. `/en/insight` → choropleth 맵이 250개 시군구로 그려지는지
2. `/en/insight/rankings` → gap 테이블 정렬 동작
3. `/en/insight/compare` → 3개 지역(용산구/영도구/음성군) 카드에 supplyCount 반영
4. `/en/insight/about` → limitsBody 에 "sample data" 문구
5. computer screenshot (map)

- [ ] **Step 5: 결과 공유**

스크린샷 2장(Explore, Insight) + 파이프라인 실행 로그를 사용자에게 전달. `_meta.json` 내용 요약.

- [ ] **Step 6: 최종 커밋 (필요 시)**

`.claude/launch.json` 을 새로 만들었다면:
```bash
cd /Users/takyerin/claude
git add plately/plately-web/.claude/launch.json
git commit -m "chore(plately-web): add launch.json for dev preview

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Self-Review 노트

**Spec coverage:**
- Spec §2 아키텍처 → Task 1–12 (model 패키지), Task 12–14 (web) ✅
- Spec §3.1 schema + 좌표변환 → Task 2 ✅
- Spec §3.2 localdata_filter → Task 3 ✅
- Spec §3.3 tokens + token_match (축별 boolean, confidence, matchedTokens) → Task 4–5 ✅
- Spec §3.4 tourapi_crosscheck (돈육 재검사, servesAlcohol, repMenu) → Task 6 ✅
- Spec §3.5 gap_index (전 시군구, gen-region-gap 공식 이식) → Task 7 ✅
- Spec §3.6 emit + 스키마 테스트 + _meta.json → Task 8 ✅
- Spec §3.7 run_pipeline (인자, 단계 로그) → Task 10 ✅
- Spec §4.1 egg/onion 기본 false → Task 5 Step 1 `test_strict_boolean_fields_default_false` ✅
- Spec §4.2 fetch_tourapi 실코드+모킹 → Task 11 ✅
- Spec §4.3 pyproj 좌표변환 → Task 2 ✅
- Spec §5.1 sync-pipeline-data.mjs → Task 12 ✅
- Spec §5.2 mockData.ts JSON 전환, 접근자 유지 → Task 13 ✅
- Spec §5.2 getComparisonRegions 코드 3개 샘플 존재 → Task 9 Step 3 + Task 10 `test_comparison_regions_have_supply` ✅
- Spec §5.3 테스트/약관/about 4로케일/README → Task 13–14 ✅
- Spec §5.4 model/out + public/data 둘 다 커밋 → Task 10 Step 6, Task 12 Step 4 ✅
- Spec §6 산출물 체크리스트 → 전체 Task 커버 ✅
- Spec §7 위험완화 (schema 단일지점, WGS84 샘플, _meta 마커, 229 vs 250) → Task 2/9 반영 ✅

**타입 일관성:** `to_restaurants` 출력 키 = `mockData.test.ts` 단언 키 = `sync-pipeline-data.mjs` 검증 키 = `lib/types.ts Restaurant` (id/name/area/sigunguCode/coords/cuisine/attributes/confidence/matchedTokens/repMenu/phoneVerifiedOn?). RegionGap 키 = `code/name/gwangyeok/demandScore/supplyCount/gapIndex/trendVs2019` — 세 곳 일치. attribute 14키 리스트 emit.py `_ATTR_FIELDS` = mjs `ATTR_KEYS` = types.ts `RestaurantAttributes` 일치.

**Placeholder scan:** 모든 코드 스텝에 완전한 코드 포함. TBD/TODO 없음.

**주의 지점 (실행자 참고):**
- `crosscheck_menus` 의 `out["containsPork"] != True` 비교는 pandas object 컬럼에서 동작하지만, 컬럼이 전부 bool 이면 `~out["containsPork"]` 로 바꿔도 됨. 테스트가 잡아준다.
- `match_tokens` 가 빈 결과일 때 컬럼 스키마 — Task 5 구현의 fallback DataFrame 은 최소 컬럼만. `run_pipeline` 은 항상 샘플에 후보가 있으므로 문제 없음. 빈 입력 방어는 `compute_gap` 의 `pd.Series(dtype=int)` 로 커버.
- 컴포넌트 테스트(`RestaurantCard.test.tsx` 등)는 자체 mock 객체를 쓰므로 이번 변경에 안전. Task 13 Step 4 에서 전체 `npm test` 로 확인.
