# Plately — 데이터 연동 (파이프라인 뼈대 + 229 샘플 end-to-end)

- 작성일: 2026-08-28
- 상태: 초안 (사용자 검토 대기)
- 근거 문서: Notion "🛠️ 구현 파이프라인 & 필요 데이터·툴" (`3c9046ef12cb8127b055caa24d74c185`)
- 전제: `plately-web`이 mock 데이터로 동작 중, 접근자 seam(`lib/mockData.ts`)이 이미 존재.

## 1. 목표

Notion에 정리된 5단계 파이프라인(LOCALDATA 필터 → 상호명 토큰 매칭 → TourAPI 메뉴 대조 → 전화 검증 → 수요-공급 갭 지수)을
독립 Python 패키지 `plately/model/`로 구현하고, 그 산출물(JSON)을 `plately-web`이 기존 접근자 seam을 통해 읽도록 연결한다.

이번 세션 범위:
- **실데이터 다운로드 없음.** 손으로 작성한 샘플 입력(fixture)으로 파이프라인 전 단계가 end-to-end 동작.
- 산출물이 `plately-web`에 반영되어 Explore/Insight 화면이 샘플 데이터로 렌더링됨.
- 실제 LOCALDATA / TourAPI / 데이터랩 export는 **파일 교체만으로** 연결되도록 인터페이스 고정.

비목표: 실 API 호출, 전화 검증 워크플로 실행(4단계는 문서화된 체크리스트 + `phoneVerifiedOn` 통과만), 지도 시각화 변경, 갭 지수 알고리즘 고도화.

## 2. 아키텍처 (Approach A)

```
plately/
  model/                        ← 신규. dajim/model/ 레이아웃 미러
    README.md  .env.example  requirements.txt  .gitignore
    pipeline/
      __init__.py
      schema.py                 LOCALDATA 컬럼명·업태코드, TourAPI 필드 (best-effort, 캐비엇 주석)
      localdata_filter.py       CSV → 영업중 + 주류 인허가 업태 제외
      tokens.py                 Notion 문서의 배제/포함 토큰 리스트 (축별)
      token_match.py            상호명 → 축별 독립 boolean 컬럼
      tourapi_crosscheck.py     대표메뉴·취급메뉴 텍스트 → 육수 돈육 확인 + serves_alcohol 채움
      gap_index.py              후보 공급 vs 데이터랩 수요 → 시군구별 gapIndex
      emit.py                   DataFrame → restaurants.json / region-gap.json (lib/types.ts 형태)
    scripts/
      run_pipeline.py           samples → model/out/*.json
      fetch_tourapi.py          스텁: API 키 + 후보 목록 → 메뉴 텍스트 (이번 세션 미실행)
    data/samples/
      localdata.sample.csv          ~50개 음식점, ~8개 시군구
      datalab-visitors.sample.csv   전체 시군구(geojson 기준 250개 코드) fake-demand
      tourapi/<contentid>.json      메뉴 텍스트 fixture 몇 개
    tests/
      test_localdata_filter.py  test_token_match.py  test_tourapi_crosscheck.py
      test_gap_index.py         test_emit_schema.py
    out/                        gitignore, 단 web이 소비하는 스냅샷은 커밋

plately-web/
  scripts/sync-pipeline-data.mjs   ../model/out/*.json → 형태 검증 → public/data/*.json
  public/data/restaurants.json     신규 (동기화 산출물, 커밋)
  public/data/region-gap.json      기존 파일을 파이프라인 산출물로 교체
  lib/mockData.ts                  인라인 배열 삭제, JSON import로 전환 (파일명 유지)
```

**격리 원칙:** `model/`은 `plately-web`과 코드 공유 없음. 공유하는 것은 (1) `lib/types.ts`의 인터페이스 형태, (2) 시군구 코드 체계뿐.
`dajim/model` ↔ `dajim-web` 관계와 동일.

## 3. Python 파이프라인 상세

### 3.1 schema.py — 입력 계약 (best-effort)

dajim `schema.py`와 동일한 방침: 실제 헤더를 확인하기 전까지 표준 용어 기반 추정이며 상단에 캐비엇 주석. 모든 컬럼 상수는 여기서만 정의.

- LOCALDATA: `사업장명`(상호명), `영업상태명`, `상세영업상태명`, `업태구분명`, `소재지전체주소`/`도로명전체주소`, `좌표정보(x)`/`좌표정보(y)` (TM중부원점 → WGS84 변환 필요), 시군구 코드는 `관리번호` 접두 또는 주소 파싱.
- 주류 인허가 업태(제외): 유흥주점, 단란주점, 감성주점, 소주방/대포집, 호프/통닭(주류 위주).
- TourAPI: `contentid`, `title`, `firstmenu`(대표메뉴), `treatmenu`(취급메뉴), `mapx`/`mapy`.

좌표 변환: LOCALDATA는 EPSG:5174(TM중부원점). `pyproj`로 WGS84(EPSG:4326) 변환. 샘플 CSV는 이미 WGS84로 작성해 `pyproj` 없이도 테스트가 돌도록 하되, 변환 함수는 구현+테스트.

### 3.2 localdata_filter.py

입력: LOCALDATA CSV 경로. 출력: `pd.DataFrame` (영업중 음식점만).

1. `영업상태명 == "영업/정상"` (그리고 `상세영업상태명` 이 폐업/휴업 아님) → 유지
2. `업태구분명` 이 주류 인허가 업태 목록에 포함 → 제외
3. 좌표 결측/범위 밖(한반도 bbox) → 제외
4. 시군구 코드 부여 (주소 → 코드 매핑 테이블; 샘플은 코드 컬럼 직접 제공)

### 3.3 tokens.py + token_match.py — 핵심 로직

`tokens.py`: Notion 문서 그대로.

```python
EXCLUDE_PORK = ["돼지국밥","삼겹살","족발","보쌈","순대","갈매기살","항정살","수육","제육",
                "돈까스","탕수육","짬뽕","부대찌개","감자탕","뼈해장국","막창","곱창"]
INCLUDE_AXES = {
  "seafood": ["횟집","회","물회","생선구이","조개","해물","아구","대구탕","초밥","전복"],
  "chicken": ["삼계탕","백숙","닭갈비","닭한마리","치킨"],
  "beef":    ["한우","곰탕","설렁탕","갈비탕","육개장"],
  "vegetarian": ["사찰음식","채식","비건","나물","산채","두부"],
  "muslim":  ["케밥","할랄","HALAL","이스탄불","사마르칸트","타지마할","나마스테","아라비안"],
}
ALCOHOL_MENU = ["소주","맥주","막걸리","생맥주","하이볼","와인","사케","고량주"]
```

`token_match.py`: Notion의 "이진 라벨 → 다차원 속성 태그" 요구대로 **축별 독립 boolean 컬럼** 생성. 상호명(그리고 3단계에서 메뉴 텍스트)에서:

| 산출 컬럼 (RestaurantAttributes 매핑) | 규칙 |
| --- | --- |
| `containsPork` | EXCLUDE_PORK 토큰 매칭 → `True`, 아니면 `False` |
| `containsBeef` | INCLUDE_AXES["beef"] 매칭 → `True`, 아니면 `False` |
| `containsChicken` | INCLUDE_AXES["chicken"] 매칭 |
| `containsFish` / `containsSeafood` | INCLUDE_AXES["seafood"] 매칭 (생선류 vs 조개·갑각 구분은 토큰별) |
| `vegetarianFriendly` | INCLUDE_AXES["vegetarian"] 매칭 |
| `servesAlcohol` | 상호명만으로는 `'unknown'`; 3단계 메뉴 텍스트에서 ALCOHOL_MENU 매칭 시 `True` |
| `containsEgg`, `containsOnionGarlic` | 타입이 strict `boolean`(Tristate 아님). 상호명에 신호 없음 → 기본 `false` (거짓 배제 방지; 앱 필터는 `=== true`일 때만 제외). 실제 확인은 전화 검증 영역 |
| `porkDerivedIngredients`, `containsGelatin`, `nonHalalMeat`, `crossContaminationRisk` | 항상 `'unknown'` (전화 검증 전까지) |
| `halalCertified` | INCLUDE_AXES["muslim"] 의 "할랄/HALAL" 명시 매칭 시에만 후보 표시, 그래도 검증 전엔 `false` (경기관광공사 데이터와 대조 시 승격) |

**후보 승격 규칙:** `containsPork == False` AND (임의의 INCLUDE 축 매칭 OR 업태가 명백히 pork-free 성격). 승격 안 된 행은 산출물에서 제외.

`confidence` 필드: 토큰 매칭까지만 = `'name'`, TourAPI 대조 통과 = `'menu'`, `phoneVerifiedOn` 존재 = `'phone'`.
`matchedTokens`: 실제 매칭된 토큰 리스트.

### 3.4 tourapi_crosscheck.py

입력: 3.3 후보 DataFrame + `tourapi/` fixture 디렉터리 (contentid → 메뉴 JSON). 매칭 키는 상호명 + 좌표 근접.

1. `firstmenu` + `treatmenu` 텍스트에서 EXCLUDE_PORK 재검사 → 상호명에서 놓친 돈육 메뉴 발견 시 `containsPork = True` (후보 탈락)
2. ALCOHOL_MENU 매칭 → `servesAlcohol = True`
3. 메뉴 텍스트를 `repMenu`(대표 메뉴 배열)로 저장
4. 대조된 행은 `confidence = 'menu'`

fixture 없는 후보는 `confidence = 'name'` 유지하고 통과 (샘플 규모라 허용).

### 3.5 gap_index.py

입력: 4단계까지 통과한 후보 DataFrame + `datalab-visitors.sample.csv`.

- `supplyCount[시군구]` = 해당 시군구 후보 수
- `demandScore[시군구]` = 데이터랩 무슬림/외국인 방문자 지표 0–100 정규화 (샘플은 이미 0–100로 작성)
- `gapIndex` = 기존 `gen-region-gap.mjs` 공식 이식: `clamp(0..100, round(demandScore - relief*30))`, `relief = supplyCount / max(1, demandScore/10)`
- `trendVs2019` = 데이터랩 샘플의 2019 대비 증감 컬럼 (없으면 0)
- 모든 시군구 코드(geojson 기준 250개)에 대해 행 생성 — 후보 없는 시군구는 `supplyCount = 0`

### 3.6 emit.py — 출력 계약

`restaurants.json`: `Restaurant[]` (`lib/types.ts`).
- `id`: `r-{시군구}-{슬러그}` 결정적 생성
- `name`/`area`: `ko`는 실제, `en`/`ar`/`hi`는 이번 세션엔 `ko` 폴백 (기존 region 처리와 동일). 향후 번역 파이프라인 별도.
- `coords`: `[lng, lat]`
- `cuisine`: 매칭된 주 축 → 문자열 (`korean-chicken`, `seafood`, `halal`, ...) — 기존 mock의 cuisine 값 집합 재사용
- `sigunguCode`, `attributes`, `confidence`, `matchedTokens`, `repMenu`, `phoneVerifiedOn?`

`region-gap.json`: `RegionGap[]` — 필드 `code, name, gwangyeok, demandScore, supplyCount, gapIndex, trendVs2019` (기존과 동일).
샘플 표시: 별도 사이드카 `public/data/_meta.json` = `{ "sampleData": true, "generatedAt": "<iso>", "restaurants": <n>, "regions": <n> }`.
(RegionGap 인터페이스는 건드리지 않음 — 화면 코드 영향 0.)

`test_emit_schema.py`: 산출 JSON의 모든 키/타입이 `lib/types.ts` 인터페이스와 일치하는지 검증 (TS 파싱 or 하드코딩된 스펙 리스트).

### 3.7 run_pipeline.py

```
python -m scripts.run_pipeline \
  --localdata data/samples/localdata.sample.csv \
  --tourapi-dir data/samples/tourapi \
  --datalab data/samples/datalab-visitors.sample.csv \
  --out out/
```

기본값이 샘플 경로라 인자 없이 실행하면 샘플로 동작. 각 단계 통과 건수를 stdout에 로그 (Notion 파이프라인 다이어그램과 동일 포맷).

## 4. 확정된 세부 결정

1. **`containsEgg` / `containsOnionGarlic`**: strict `boolean` 타입이므로 `'unknown'` 불가. 상호명 신호가 없으면 기본 `false` (거짓 배제 방지). 실제 성분 확인은 4단계 전화 검증에서.
2. **`fetch_tourapi.py`**: 실제 요청 코드까지 작성하되 이번 세션엔 미실행. `tourapi_crosscheck` 테스트는 응답 fixture로 모킹.
3. **좌표계**: `pyproj`로 EPSG:5174→4326 변환 함수 구현+테스트. 샘플 CSV는 WGS84로 작성해 파이프라인 기본 실행은 `pyproj` 없이도 가능.

## 5. plately-web 연동 상세

### 5.1 sync-pipeline-data.mjs
- `../model/out/restaurants.json`, `../model/out/region-gap.json`, `../model/out/_meta.json` 읽기
- 형태 검증 (필수 키, 타입, 좌표 범위, gapIndex 0–100). 실패 시 non-zero exit
- `public/data/`로 복사
- `package.json`에 `"sync:data": "node scripts/sync-pipeline-data.mjs"` 추가

### 5.2 lib/mockData.ts (파일명 유지)
- 상단 `RESTAURANTS` 인라인 배열(28개) 삭제 → `import restaurantsJson from '@/public/data/restaurants.json'`
- `export const RESTAURANTS: Restaurant[] = restaurantsJson as Restaurant[]`
- `getRestaurants` / `getRestaurant` / `getRegions` / `getRegion` / `getComparisonRegions` 시그니처·동작 유지
- `getComparisonRegions`의 하드코딩 코드 3개(`11030`, `21040`, `33370`)가 샘플 데이터에 존재하도록 샘플 구성 (Known shortcut 유지)
- `getRegion`의 `topCandidateIds`는 계속 런타임 계산

### 5.3 테스트·문서
- `lib/mockData.test.ts`, `lib/filter.test.ts`: 동기화된 fixture 기준으로 기대값 갱신 (개수·특정 id 대신 속성 기반 단언으로 완화)
- `lib/i18n.test.ts` 등 나머지 유닛 테스트 영향 없음
- e2e (`tests/e2e/*`): 시드 세션 방식 그대로, 라우트 렌더만 확인하므로 영향 없음
- `/insight/about` i18n 키 `limitsBody` 4개 로케일(en/ko/ar/hi): "mock data" → "sample data (LOCALDATA/TourAPI/데이터랩 실데이터 연결 전)" 취지로 갱신. 새 키 추가 없음
- `plately-web/README.md` "## Data" 섹션 + 루트 `README.md` "Data pipeline (planned)" → 현행화

### 5.4 CI/실행 순서
개발자 흐름: `cd model && python -m scripts.run_pipeline` → `cd ../plately-web && npm run sync:data` → `npm run dev`.
`model/out/`의 스냅샷과 `plately-web/public/data/`의 동기화 결과를 **둘 다 커밋** (web은 Python 없이도 빌드 가능해야 함).

## 6. 산출물 체크리스트

- [ ] `plately/model/` 패키지 (pipeline 6모듈 + scripts 2 + tests 5)
- [ ] 샘플 입력 3종 (localdata ~50행 / datalab 250코드 / tourapi fixture 다수)
- [ ] `model/out/{restaurants,region-gap,_meta}.json` 커밋 스냅샷
- [ ] `model/README.md`, `.env.example`, `requirements.txt` (pandas, requests, pyproj, pytest)
- [ ] `plately-web/scripts/sync-pipeline-data.mjs` + `sync:data` 스크립트
- [ ] `lib/mockData.ts` JSON 전환, 접근자 유지
- [ ] `public/data/restaurants.json` 추가, `region-gap.json` 교체
- [ ] 유닛 테스트 갱신 (Python pytest 그린 + JS vitest 그린)
- [ ] about 4로케일 카피 + README 2개 현행화
- [ ] `npm run dev`로 Explore/Insight 샘플 데이터 렌더 확인 (스크린샷)

## 7. 위험 / 완화

- **LOCALDATA 실제 스키마 미확인** → `schema.py` 단일 지점 집약 + 캐비엇 주석 (dajim 선례)
- **좌표계 변환** → `pyproj` 구현하되 샘플은 WGS84로 작성해 테스트 독립성 확보
- **샘플 데이터가 실데이터처럼 오인** → `_meta.json { sampleData: true }` + about 카피 + 커밋 메시지 명시
- **229 vs 250 시군구** → 실제 앱 지도는 geojson의 250개 코드에 키됨. 파이프라인도 250개 코드 기준으로 emit (Notion의 "229"는 행정 구역 수, geojson 폴리곤은 250)
