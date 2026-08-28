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
| `data/samples/localdata.sample.csv` | 행안부 일반음식점 API(15154916) → `scripts/fetch_localdata.py` 로 `data/raw/localdata.parquet` 수집 후 `--localdata-format api --localdata data/raw/localdata.parquet`. 좌표 EPSG:5174→WGS84, 소재지주소→시군구코드는 `pipeline/localdata_adapter.py` |
| `data/samples/tourapi/*.json` | `scripts/fetch_tourapi.py`로 수집한 메뉴 JSON (`--tourapi-dir`) |
| `data/samples/datalab-visitors.sample.csv` | 데이터랩 무슬림/외국인 방문자 export (`--datalab`) |
| `data/real/*.csv` (원본 형식, 대응 샘플 없음 — `data/real/README.md` 참조) | 데이터랩 "외국인 지역별 방문자 수" + "방문자 거주지(국가)" export → `--datalab-format regional --datalab <지역별 방문자 파일> --datalab-country <거주지(국가) 파일>` |

컬럼명이 다르면 `pipeline/schema.py` 한 곳만 고치면 된다.

`--localdata-format api` 는 실 LOCALDATA(행안부 API 또는 그 parquet/CSV)를 `pipeline/localdata_adapter.py`
로 정규화한다 (좌표 EPSG:5174→WGS84, 소재지주소→시군구코드; `--geojson` 필요). 산출 `_meta.json` 에
`supplySource: "localdata-api"` 가 기록된다 (sample 모드는 `supplySource: "sample"`).
`--model-restaurant-csv data/real/모범음식점정보.csv` 를 주면 `주된음식종류` 를 (정규화 상호명, 시군구코드)
조인으로 붙여 2단계 토큰 매칭의 추가 신호로 쓴다 (`pipeline/model_restaurant.py`).

regional 모드는 `pipeline/datalab_adapter.py`(이름→시군구코드, 통합시 균등분배, 백분위 정규화) + `pipeline/muslim_share.py`(거주지 국가 → 전국 무슬림권 비중)를 사용한다. 산출 `_meta.json` 에 `demandSource: "datalab-regional"` 와 `muslimShare` 가 기록된다 (sample 모드는 `demandSource: "sample"`, `muslimShare` 없음). 커밋 스냅샷(`out/`)은 sample 모드 유지.

## 테스트

```bash
pytest
```
