# Plately — LOCALDATA 공급 축 실연동 (API 15154916 + 모범음식점 주된음식종류)

- 작성일: 2026-08-28
- 상태: 승인됨 (2026-08-28 — 사용자가 접근 A 확정: region_codes 추출 + datalab_adapter 리팩터)
- 선행: `2026-08-28-plately-data-integration-design.md` (스켈레톤), `2026-08-28-plately-datalab-real-adapter-design.md` (수요 축). PR https://github.com/Eggtakk/Plately/pull/1.
- 목표: Notion 파이프라인 1–2단계의 **공급(식당)** 입력을 실 LOCALDATA(행안부 일반음식점 API 15154916)로 연결하고, 모범음식점 `주된음식종류`를 토큰 매칭 추가 신호로 사용.

## 1. 사용자 결정 사항

- **데이터 확보**: API 15154916 (공공데이터포털 활용신청 + `DATA_GO_KR_API_KEY`). 이번 세션 미실행 — `fetch_localdata.py` 스캐폴드 + 순수 파서 테스트만.
- **범위**: 전국 전체 (약 70만 → 필터 후 수천).
- **모범음식점**: `주된음식종류` → 토큰 매칭 추가 신호만 (전화번호/별도 confidence 등급은 이번 범위 아님).
- **세션 목표**: 뼈대 + 소형 실샘플(손 작성 실LOCALDATA 형식 fixture)로 검증.
- **접근 A**: `region_codes.py` 추출 + `datalab_adapter.py` 리팩터.
- 모범음식점 CSV → `data/real/모범음식점정보.csv` (gitignore, `data/real/README.md` 문서화).

## 2. 아키텍처

```
plately/model/
  pipeline/
    region_codes.py       신규 — 광역/기초명 → 5자리 시군구코드 리졸버 (datalab_adapter 에서 추출)
    localdata_adapter.py   신규 — 실 LOCALDATA row → filter_localdata 입력 형태
    model_restaurant.py    신규 — 모범음식점 CSV → menu_hint 조인
    datalab_adapter.py     리팩터 — RegionResolver 사용
    token_match.py         수정 — _match_one(name, extra_text="") + match_tokens 가 menu_hint 소비
    schema.py              수정 — LOCALDATA API 응답 필드 별칭
  scripts/
    fetch_localdata.py     신규 — API 15154916 클라이언트 (미실행, 순수 파서만 테스트)
    run_pipeline.py        수정 — --localdata-format {sample,api} + --model-restaurant-csv
  tests/
    test_region_codes.py
    test_localdata_adapter.py
    test_model_restaurant.py
    test_fetch_localdata.py
    fixtures/localdata-real-sample.csv   손 작성, 실 LOCALDATA 컬럼명 + EPSG:5174 좌표
    fixtures/model-restaurant-mini.csv   cp949, ~6행
  data/real/모범음식점정보.csv           gitignore
```

`filter_localdata.py` 는 **무변경** (이미 "LOCALDATA 또는 샘플 DataFrame" 받도록 설계됨 — 어댑터가 형태를 맞춤).

## 3. `pipeline/region_codes.py` (추출)

`datalab_adapter.py` 에서 아래를 그대로 옮김: `GWANGYEOK_PREFIX`, `NAME_ALIASES`, `VINTAGE_OVERRIDES`, `_GWANGYEOK_EN`, `_city_key`, geojson 인덱스 구축, 매칭 사다리.

```python
class RegionResolver:
    def __init__(self, geojson_path: Path):
        # exact_index: {(prefix, name): code}
        # prefix_index: {(prefix, city_key): [codes]}   # 통합시
    def resolve(self, gwangyeok: str, sigungu: str) -> str | None:
        # 1) exact (prefix, alias(sigungu))  2) prefix_index → codes (호출측이 균등분배)
        # 3) VINTAGE_OVERRIDES  4) None
    def resolve_codes(self, gwangyeok: str, sigungu: str) -> list[str]:
        # 통합시면 여러 코드, 아니면 1개, 실패면 []
    def resolve_from_address(self, address: str) -> str | None:
        # "서울특별시 종로구 세종대로 …" → 앞 두 토큰(광역, 기초) 추출 → resolve
        # 세종처럼 기초=광역인 경우, "경기도 수원시 장안구 …" 처럼 일반구까지 있는 경우 처리
    GWANGYEOK_EN: dict[str, str]   # prefix → English (emit/gap 용)
```

### `resolve_from_address` 규칙
- 주소를 공백 분리. `parts[0]` = 광역명 (GWANGYEOK_PREFIX 키와 매칭). 
- `parts[1]` = 기초명 후보. `parts[1]` 이 `…시` 이고 `parts[2]` 가 `…구` 로 끝나면 `parts[1]+parts[2]` (통합시 일반구, 예: `수원시 장안구` → `수원시장안구`).
- 세종: `parts[0] == "세종특별자치시"` → 기초명도 `세종특별자치시` (alias → `세종시`).
- 그 외 → `resolve(parts[0], 기초명)`. 통합시(수원시 등)는 `resolve` 가 prefix_index 로 여러 코드 → **주소에 일반구가 없으면** 첫 코드 사용 + 경고, 있으면 정확 매칭.
- 광역명 미매칭 / 토큰 부족 → `None`.

### `datalab_adapter.py` 리팩터
`load_regional_demand` 이 `RegionResolver` 사용하도록:
- 자체 인덱스 구축 코드 삭제 → `resolver = RegionResolver(geojson)`.
- CSV 행마다 `resolver.resolve_codes(광역명, 기초명)` → 1개면 raw 그대로, k개면 raw/k (균등분배 유지).
- `resolve_matches`, `load_regional_demand` 시그니처/반환 유지 (기존 `test_datalab_adapter` 전체 통과 = 회귀망).
- `VINTAGE_OVERRIDES` 등 상수는 `region_codes` 로 이동. `datalab_adapter` 는 backward-compat 로 재export (`from pipeline.region_codes import GWANGYEOK_PREFIX, NAME_ALIASES, VINTAGE_OVERRIDES` — `_city_key` 도) → `test_datalab_adapter.py` 무변경.

## 4. `pipeline/localdata_adapter.py`

```python
def normalize(raw: pd.DataFrame, resolver: RegionResolver) -> pd.DataFrame:
    """실 LOCALDATA(또는 API dump) → filter_localdata 입력 형태.
    입력 컬럼(schema 상수): 사업장명, 영업상태명, 상세영업상태명, 업태구분명,
                            소재지전체주소, 좌표정보(x), 좌표정보(y)
    출력: 위 4개 passthrough + lng, lat, sigungu_code 컬럼 추가
    """
```
- `lng, lat` = 행별 `schema.tm_to_wgs84(float(x), float(y))`. 실패/결측 → `NaN` (filter 의 bbox 에서 자동 제거). pyproj 필수 (regional 모드는 pyproj 있어야 함 — requirements 에 이미 있음).
- `sigungu_code` = `resolver.resolve_from_address(소재지전체주소)` 또는 `""`. `""` 비율을 stderr 에 경고 (`f"  ⚠ 주소→코드 실패 {n}/{total}"`).
- passthrough 컬럼은 `schema` 상수명 그대로 유지 → `filter_localdata` 가 그대로 읽음.
- `filter_localdata` 는 `SIGUNGU_CODE_COL`, `LNG_COL`, `LAT_COL` 을 요구하므로 이 3개가 출력에 있어야 함 (샘플 CSV 와 동일 계약).

주의: `filter_localdata` 는 현재 `df[schema.LNG_COL]` 등을 직접 참조. `normalize` 출력 컬럼명이 `schema.LNG_COL`("lng"), `schema.LAT_COL`("lat"), `schema.SIGUNGU_CODE_COL`("sigungu_code") 와 일치해야 함. → 일치시킴.

## 5. `pipeline/model_restaurant.py`

```python
def load_menu_hints(model_csv: Path, resolver: RegionResolver) -> pd.DataFrame:
    """모범음식점정보.csv (cp949) → columns: join_name, sigungu_code, menu_hint
    - pd.read_csv(model_csv, encoding="cp949", dtype=str)  # 따옴표 필드 처리 위해 pandas
    - 영업상태명 == "영업" 만
    - 업소명 → join_name (정규화: 공백 제거, 대문자)
    - resolver.resolve_from_address(소재지주소 or 도로명주소) → sigungu_code
    - 주된음식종류 → menu_hint (빈 값이면 행 제외)
    """

def annotate(candidates: pd.DataFrame, hints: pd.DataFrame) -> pd.DataFrame:
    """candidates(filter_localdata 출력: name, sigungu_code, lng, lat, biztype)
    에 menu_hint 컬럼 추가. 조인 키 = (정규화 name, sigungu_code). 미매칭 → menu_hint=''
    """
```
- 조인은 (정규화 상호명 완전일치, sigungu_code 일치). 1차 버전 — 좌표 근접/퍼지 매칭은 비목표.
- 여러 모범음식점이 같은 키 → 첫 `menu_hint` 사용 (드묾).

## 6. `pipeline/token_match.py` 수정

```python
def _match_one(name: str, extra_text: str = "") -> dict | None:
    hay = f"{name} {extra_text}".strip()
    hits = _found(hay, tokens.EXCLUDE_PORK)
    ...
    for axis, needles in tokens.INCLUDE_AXES.items():
        found = _found(hay, needles)
        ...
```
`match_tokens(df)`: `menu_hint = str(r["menu_hint"]) if "menu_hint" in df.columns else ""`, `_match_one(str(r["name"]), menu_hint)`.
- `matchedTokens` 은 name/hint 출처 구분 안 함.
- 후보 승격 규칙 동일 (`contains_pork` or 축 매칭 0 → 탈락).
- **기존 `test_token_match` 전부 무변경 통과** (`extra_text=""` 기본).
- 추가 테스트: `_df` 에 `menu_hint` 컬럼 → "일미식당" + hint "삼겹살" → `containsPork=True` → 탈락. "행복회관" + hint "생선회" → seafood 승격.

## 7. `pipeline/schema.py` 수정 — API 응답 별칭

LOCALDATA API(15154916) 응답 필드는 명세 페이지에서 확인 불가 → best-effort, `fetch_localdata.parse_rows` 가 표준 컬럼명으로 매핑. 별칭 상수를 schema 에 추가:
```python
# LOCALDATA open API row → 우리 표준 컬럼 (best-effort — 실제 응답으로 검증 필요).
# localdata.go.kr / 행안부 규약 기준 추정.
LOCALDATA_API_FIELD_MAP = {
    "bplcNm": NAME_COL, "trdStateNm": STATUS_COL, "dtlStateNm": DETAIL_STATUS_COL,
    "uptaeNm": BIZTYPE_COL, "siteWhlAddr": ADDR_COL, "rdnWhlAddr": ROAD_ADDR_COL,
    "x": X_COL, "y": Y_COL,
}
```

## 8. `scripts/fetch_localdata.py` (미실행)

```python
BASE = "https://apis.data.go.kr/15154916/..."   # best-effort — 명세 Swagger 로 검증
def build_params(api_key: str, page_no: int, num_rows: int, *, local_code: str | None = None) -> dict
def parse_rows(body: dict) -> list[dict]   # response → [{표준컬럼명: 값}], schema.LOCALDATA_API_FIELD_MAP 사용
def main()   # --out data/raw/localdata.parquet, 페이지네이션, DATA_GO_KR_API_KEY, 시도별 청크(local_code 앞2자리)
```
순수 함수(`build_params`, `parse_rows`)만 fixture JSON 으로 테스트. 실 HTTP 없음. `requests`/`dotenv` (이미 deps).
docstring 에 "endpoint/params/fields 는 best-effort — 첫 실행 시 응답 1페이지 저장해 검증하고 이 파일 + schema 를 고칠 것" 명시.

## 9. `scripts/run_pipeline.py` 배선

```python
--localdata-format {sample, api}   default "sample"
--model-restaurant-csv <path>      default None
```
`run(..., *, localdata_format="sample", model_restaurant_csv=None)`:
```python
resolver = None
if localdata_format == "api":
    from pipeline.region_codes import RegionResolver
    from pipeline import localdata_adapter
    resolver = RegionResolver(geojson)
    raw = pd.read_parquet(localdata) if str(localdata).endswith(".parquet") else pd.read_csv(localdata, dtype=str)
    raw = localdata_adapter.normalize(raw, resolver)
    supply_source = "localdata-api"
else:
    raw = pd.read_csv(localdata, dtype=str)
    for c in ["lng", "lat"]:
        raw[c] = pd.to_numeric(raw[c], errors="coerce")
    supply_source = "sample"

filtered = filter_localdata(raw)

if model_restaurant_csv:                         # match_tokens 전에 menu_hint 부착
    from pipeline.region_codes import RegionResolver
    from pipeline import model_restaurant
    resolver = resolver or RegionResolver(geojson)
    hints = model_restaurant.load_menu_hints(model_restaurant_csv, resolver)
    filtered = model_restaurant.annotate(filtered, hints)

candidates = match_tokens(filtered)              # menu_hint 컬럼 있으면 자동 사용
candidates["repMenu"] = pd.Series([[] for _ in range(len(candidates))], dtype=object, index=candidates.index)
```
`build_meta` 에 `supply_source` 추가: `emit.build_meta(..., supply_source="sample")` → `_meta["supplySource"]`.
`_meta` 최종: `{sampleData, demandSource, supplySource, muslimShare?, generatedAt, restaurants, regions, note}`.
`sync-pipeline-data.mjs` — 새 옵셔널 키 무해 (검사 안 함). 확인만.

## 10. 이번 세션 검증

- `tests/fixtures/localdata-real-sample.csv` — 손 작성, 헤더 = schema 상수(`사업장명,영업상태명,상세영업상태명,업태구분명,소재지전체주소,도로명전체주소,좌표정보(x),좌표정보(y)`), 좌표는 EPSG:5174 값(서울/부산 등 실제 좌표), 10~15행 (영업/폐업, 다양한 업태·상호).
- `tests/fixtures/model-restaurant-mini.csv` — cp949 인코딩, 모범음식점 헤더, ~6행 (삼겹살/생선회/삼계탕 등 주된음식종류).
- `test_run_pipeline` 에 api-mode 테스트: fixture 로 `run(..., localdata_format="api", localdata=<csv fixture>, model_restaurant_csv=<mini>)` → 250 시군구 gap, `_meta.supplySource == "localdata-api"`, 삼겹살 힌트 매칭된 후보 탈락 확인.
- `test_committed_snapshot_matches_fresh_run` (sample 모드) 무변경.
- 실 70만 API fetch + 실 모범음식점 65k 조인은 **사용자 몫** (README 워크플로 문서화). `model/out/` 커밋 스냅샷은 sample 유지.

## 11. 비목표

- 전화 검증(4단계), `전화번호` 필드 활용.
- 좌표 근접 / 퍼지 상호명 매칭 (1차는 상호명 완전일치 + 시군구코드).
- 모범음식점 `음식의유형`·`지정취소` 등 다른 필드.
- 실 API endpoint 확정 (best-effort, 첫 실행 시 사용자가 검증).
- Insight choropleth 렌더 이슈.
- `datalab_adapter` 의 동작 변경 (리팩터는 순수 구조 변경, 출력 동일).

## 12. 리스크

- **API 명세 불확정**: endpoint/params/fields best-effort. `schema.LOCALDATA_API_FIELD_MAP` + `fetch_localdata` 한 곳 집약 + docstring 경고. 첫 실행 시 1페이지 저장 → 검증 → 수정.
- **좌표계**: "보정계수 안들어간 Bessel 중부원점TM(EPSG:5174)" — schema.tm_to_wgs84 의 `EPSG:5174→EPSG:4326` 가정과 일치. 일부 피드가 GRS80(5186)일 수 있음 → fixture 로 서울시청 좌표 왕복 검증, 오차 크면 5174 vs 5186 재검토.
- **주소→코드 실패**: 상세주소 형식 편차(구 없는 통합시, 신주소 등). `resolve_from_address` 실패율을 로그로 가시화, 실 데이터에서 임계값 넘으면 규칙 보강.
- **datalab_adapter 리팩터 회귀**: 기존 `test_datalab_adapter` + `test_run_pipeline` regional 테스트가 회귀망. 리팩터 후 전체 스위트 그린 필수.
- **모범음식점 조인율 낮음 가능**: 상호명 완전일치 + 코드 → 미스 많을 수 있음. menu_hint 없으면 상호명만으로 매칭(현행) → 후퇴 아님, 개선분만 상실. 조인율 로그.
