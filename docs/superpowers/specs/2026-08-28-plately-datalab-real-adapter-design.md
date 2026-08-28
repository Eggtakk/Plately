# Plately — 데이터랩 실데이터 어댑터 (수요 축 연동)

- 작성일: 2026-08-28
- 상태: 승인됨 (2026-08-28 — 사용자가 통합시 균등분배 + `data/real/*.csv` gitignore 확정)
- 선행: `2026-08-28-plately-data-integration-design.md` (파이프라인 스켈레톤). Task 1–14 완료, `plately-data-integration` 브랜치.
- 목표: 데이터랩 **외국인 지역별 방문자 수** + **거주지(국가)** export 를 파이프라인 5단계(gap_index)의 실제 수요 입력으로 연결.

## 1. 배경

스켈레톤의 `--datalab` 는 이미 `sigungu_code, sigungu_name, gwangyeok, demand_score, trend_vs_2019` 형태의 CSV 를 받는다.
사용자가 받은 데이터랩 원본은 그 형태가 아니라:

| 파일 | 컬럼 | 단위 |
| --- | --- | --- |
| `외국인 지역별 방문자 수.csv` | 광역지자체명, 기초지자체명, 광역 방문자수/비율, **기초지자체 방문자 수**, 기초 비율 | 229 시군구(일부 통합시) |
| `외국인 방문자 거주지(국가).csv` | 국가명, 비율(%) | 전국 24개국 |
| `무슬림 방문자수.csv` | (대륙 × 월별 추정 방문자수) | 전국, 참고용 — 이번 범위 아님 |

→ 원본 → 스켈레톤 입력 형태로 변환하는 **어댑터** 2개 모듈 + `run_pipeline` 배선.

## 2. 아키텍처

```
plately/model/
  pipeline/
    datalab_adapter.py    신규 — 외국인 지역별 방문자 수 CSV → gap_index 입력 DataFrame
    muslim_share.py       신규 — 거주지(국가) CSV × 국가별 무슬림 인구비 → 전국 무슬림권 비중(float)
  data/real/
    *.csv                 gitignore (데이터랩 재다운로드). 데이터랩 export 원본.
    README.md             커밋 — 각 파일이 어느 데이터랩 메뉴의 export 인지 + 다운로드 절차
  tests/
    test_datalab_adapter.py
    test_muslim_share.py
  scripts/run_pipeline.py  수정 — --datalab-format {sample,regional} + --datalab-country
```

`.gitignore` 에 `data/real/*.csv` 추가 (기존 `data/raw/` 아래).

## 3. `muslim_share.py`

```python
def national_muslim_fraction(country_csv: Path) -> float
```

- 입력: `국가명, 비율(%)` CSV.
- `MUSLIM_FRACTION: dict[str, float]` — 국가별 무슬림 인구 비율 상수. 출처 주석 (Pew Research Center, "The Future of the Global Muslim Population" 2011 + CIA World Factbook 갱신치). CSV 에 등장하는 24개국 커버, 나머지는 0.
- `OTHER_MUSLIM_FRACTION = 0.15` — CSV 의 "기타" 항목용 보수적 추정.
- 반환: `sum( (비율/100) * MUSLIM_FRACTION.get(국가, 0) )`, "기타" 는 `OTHER_MUSLIM_FRACTION` 사용. `round(_, 4)`.
- 현재 데이터로 ≈ 0.05–0.08 예상.

상수 테이블 (CSV 등장국 기준):
```
인도네시아 0.87, 말레이시아 0.61, 카자흐스탄 0.70, 튀르키예 0.99, 아랍에미리트 0.76,
인도 0.14, 싱가포르 0.15, 필리핀 0.06, 러시아 0.10, 태국 0.05, 중국 0.017,
프랑스 0.084, 독일 0.067, 영국 0.064, 미국 0.011, 캐나다 0.034,
호주 0.032, 일본 0.002, 대만 0.003, 홍콩 0.04, 베트남 0.001, 몽골 0.03, 멕시코 0.002
```

**테스트**: 합성 CSV → 0~1 범위, 알려진 비율의 단일국 → 정확값, "기타" 항목 반영, 미매핑 국가 → 0 기여, 빈 CSV → 0.0.

## 4. `datalab_adapter.py`

```python
def load_regional_demand(
    regional_csv: Path,
    geojson: Path,
    *,
    muslim_share: float = 1.0,
) -> pd.DataFrame
```

반환: `sigungu_code, sigungu_name, gwangyeok, demand_score, trend_vs_2019` — `gap_index.compute_gap` 이 그대로 먹는 형태. **geojson 의 250개 코드 전부** 행 생성.

### 4.1 이름 → 시군구 코드 해석

geojson feature: `{ code: 5자리, name: 기초명 }`. 광역은 `code[:2]` 접두에서 파생 (kostat-2018 스킴).

- **광역명 정규화**: CSV `광역지자체명`(예: "강원특별자치도", "서울특별시", "전북특별자치도") → 2자리 접두. 17개 매핑 상수 `GWANGYEOK_PREFIX`.
  - `"11"→서울, "21"→부산, "22"→대구, "23"→인천, "24"→광주, "25"→대전, "26"→울산, "29"→세종, "31"→경기, "32"→강원, "33"→충북, "34"→충남, "35"→전북, "36"→전남, "37"→경북, "38"→경남, "39"→제주`
- **조인 키**: `(2자리 접두, 기초명)`. geojson 에서 `{ (code[:2], name): code }` 딕셔너리 구축. 기초명 충돌(중구·동구·서구 등)은 접두로 해소됨.
- **기초명 정규화**: 공백 제거 후 비교. `"세종특별자치시"`(CSV) ↔ `"세종시"`(geojson) 같은 케이스는 별칭 테이블 `NAME_ALIASES`.
- **vintage 오버라이드**: geojson(2018) 에 없거나 이동한 시군구는 `VINTAGE_OVERRIDES: dict[(광역,기초), 5자리코드]`. 최소한 군위군(2023 경북→대구) 등. 매칭 실패 시 경고 로그 + 해당 CSV 행 스킵.

### 4.2 통합시 → 일반구 균등분배 (사용자 확정)

CSV 는 `창원시`(시 전체) 한 줄, geojson 은 `창원시성산구`·`창원시마산합포구`… n개.
→ geojson 에서 `기초명.startswith(CSV기초명)` 인 코드가 여러 개면, **시 방문자수를 그 n개 구에 균등 분배** (`시 카운트 / n`). 각 구가 같은 `raw_visitors` 값을 받음.
근사치임을 모듈 docstring + README 에 명시.

구현: geojson 딕셔너리를 `{ (접두, 정확한기초명): code }` 와 별개로 `{ (접두, 시명): [code...] }` (prefix-match) 를 만들어, CSV 행마다:
1. 정확 매칭 시도 → 1개 코드, `raw = 기초지자체 방문자 수`
2. 실패 시 prefix 매칭 → k개 코드, 각 `raw = 기초지자체 방문자 수 / k`
3. 둘 다 실패 → 오버라이드 확인 → 없으면 경고+스킵

### 4.3 demand_score 정규화

`기초지자체 방문자 수` 는 heavy-tail (제주·서울 압도). min-max 하면 대부분 0 근처.
→ **백분위 랭크**: 모든 (구별) `raw_visitors * muslim_share` 를 정렬해 `demand_score = round(100 * rank / (N-1))`. N = 값이 있는 구 수.
- 값 없는(스킵된/매칭실패) 코드는 `demand_score = 0`.
- `muslim_share` 는 상수 곱이므로 백분위 순위 불변 → 실질적으로 `raw_visitors` 순위. `muslim_share` 는 `_meta.json` 기록 + about 수치용으로만 의미.

### 4.4 trend_vs_2019

이 export 에 없음 → **전부 0**. (데이터랩에서 "2019 대비" 지표를 별도로 받으면 향후 추가. UI 는 0 을 "표시 안 함"으로 처리하도록 별도 확인 — 이번 범위 아님, `trendVs2019: 0` 이 렌더 깨지지 않는지만 Task 검증에서 확인.)

## 5. `run_pipeline.py` 배선

```python
ap.add_argument("--datalab-format", choices=["sample", "regional"], default="sample")
ap.add_argument("--datalab-country", type=Path, default=None)
ap.add_argument("--geojson", type=Path, default=_HERE.parent / "plately-web/public/sigungu.simplified.geojson")
```

`run()` 시그니처에 `datalab_format="sample"`, `datalab_country=None`, `geojson=<default>` 추가.

```python
if datalab_format == "regional":
    from pipeline import datalab_adapter, muslim_share
    share = muslim_share.national_muslim_fraction(datalab_country) if datalab_country else 1.0
    demand = datalab_adapter.load_regional_demand(datalab, geojson, muslim_share=share)
    print(f"  · 무슬림권 비중          {share:.3f}")
else:
    demand = pd.read_csv(datalab, dtype={"sigungu_code": str})   # 기존
```

`build_meta` 에 `muslimShare` 필드 추가 (regional 모드일 때만; sample 모드는 `None` 또는 생략).
→ `emit.build_meta(restaurants, regions, muslim_share=None)`.
→ `sync-pipeline-data.mjs` 는 `_meta` 의 알려진 키만 검사하므로 새 옵셔널 키 무해 (확인).

## 6. `data/real/README.md` (커밋)

각 파일 → 데이터랩 메뉴 경로 + 옵션 + 다운로드일. 예:
- `20260828160034_외국인 지역별 방문자 수.csv` — 한국관광 데이터랩 → 관광통계 → 지역별(관광 빅데이터) → 지역: 시군구 / 구분: 외국인 / 지표: 방문자수 / 기간: (다운로드일 기준). 2026-08-28 다운로드.
- `20260828160042_외국인 방문자 거주지(국가).csv` — 동 → 방문자 거주지(국가별). 2026-08-28.
- `무슬림 방문자수.csv` — (참고용, 어댑터 미사용).

실행:
```bash
cd model
python -m scripts.run_pipeline \
  --datalab-format regional \
  --datalab "data/real/20260828160034_외국인 지역별 방문자 수.csv" \
  --datalab-country "data/real/20260828160042_외국인 방문자 거주지(국가).csv"
cd ../plately-web && npm run sync:data
```

## 7. 산출물 체크리스트

- [ ] `.gitignore` += `data/real/*.csv`
- [ ] `pipeline/muslim_share.py` + `tests/test_muslim_share.py`
- [ ] `pipeline/datalab_adapter.py` + `tests/test_datalab_adapter.py` (이름해석 / 균등분배 / 백분위 / 매칭실패 / 250행 커버)
- [ ] `scripts/run_pipeline.py` 배선 + `tests/test_run_pipeline.py` 에 regional 모드 테스트 (실 CSV fixture 소량 or 실제 `data/real/` 사용 — 후자는 gitignore 라 CI 불가 → **소형 합성 fixture** `tests/fixtures/` 권장)
- [ ] `emit.build_meta` muslim_share 옵셔널 필드 + `test_emit` 갱신
- [ ] `data/real/README.md`
- [ ] `model/README.md` "실데이터로 교체" 표에 regional 모드 추가
- [ ] `emit.build_meta` 에 `demandSource` 필드: sample 모드 → `"sample"`, regional 모드 → `"datalab-regional-<YYYY-MM>"`. `sampleData` 는 restaurants 기준 유지 (LOCALDATA 미연동이므로 항상 `true`). 즉 `_meta = { sampleData: true, demandSource, muslimShare, generatedAt, restaurants, regions }`.
- [ ] **커밋 정책**:
  - `model/out/*.json` 커밋 스냅샷 = **sample 모드** 유지 (CI 재현 가능). regional 실행은 `out/` 을 덮어쓰지만 그 결과는 커밋하지 않음.
  - `plately-web/public/data/*.json` (gitignore 아님, 앱 데이터) = 사용자가 로컬에서 `run_pipeline --datalab-format regional` + `npm run sync:data` 후 커밋. 이 Task 는 그 워크플로를 문서화만; 실 regional 스냅샷 커밋은 사용자 몫(원본 CSV 로컬 필요).
  - `test_run_pipeline` snapshot-drift 테스트: **sample 모드 그대로 유지**, 변경 없음.
- [ ] Task 검증에서 실제 `data/real/` CSV 로 regional 모드 1회 실행 → 매칭 실패 목록 리뷰 + `VINTAGE_OVERRIDES` 채움 + 산출 250행 sanity (demand_score 0~100, 0 인 코드 수 보고) — 로그만, 커밋 없음.

## 8. 비목표

- LOCALDATA/모범음식점 실데이터 연동 (공급 축) — 별도.
- `무슬림 방문자수.csv` 활용 (월별 계절성) — 별도.
- 데이터랩 "2019 대비" 추세 지표.
- UI 변경 (about 문구가 "sample" 을 말하는 부분은 demand 가 실데이터가 되면 부정확해지나, restaurants 가 샘플인 한 "프로토타입" 문구는 유효 — 미세 조정은 별도).

## 9. 리스크

- **geojson vintage(2018) vs 데이터랩(현재)**: 통합시·분구·군위군 등. `VINTAGE_OVERRIDES` + 매칭실패 경고로 가시화. 매칭 실패 구는 `demand_score=0` → 지도에서 회색. Task 에서 실 CSV 로 실행해 **매칭 실패 목록을 리뷰**하고 오버라이드 채움.
- **균등분배 근사**: 창원(5구)·수원(4구) 등에서 구별 실제 방문자 편차 무시. 문서화. 향후 인구·POI 가중 가능.
- **`data/real/` gitignore** → `out/` regional 스냅샷을 커밋해도 재생성 불가(CI). 그래서 스냅샷 테스트는 sample 모드만. regional `out/` 은 "사용자가 로컬에서 생성" 워크플로.
