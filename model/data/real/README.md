# data/real/

파이프라인 실데이터 입력. **CSV 는 gitignore** (`.gitignore`: `data/real/*.csv`, `data/raw/`).
이 README 와 파이프라인 코드만 커밋.

## 팀 공유본 (2026-08-28 스냅샷 — 공모전은 이걸로 통일)

- Google Drive `real/`: https://drive.google.com/drive/folders/1DUussFKe0pHjshycVtrhxPSwT7bWepJ7?usp=sharing
  - 아래 표의 데이터랩 3종 + `모범음식점정보.csv`
- **`식품_일반음식점.csv` (LOCALDATA 전국, 696MB)** 은 드라이브 용량 초과로 미포함 →
  [data.go.kr/data/15045016](https://www.data.go.kr/data/15045016/fileData.do) 에서 재다운로드.
  (인허가 데이터라 매일 행 수가 바뀜 — 정확한 재현이 필요하면 팀에서 별도 공유)

## 파일

| 파일 (`data/real/` 또는 `data/raw/`) | 출처 · 옵션 | 인코딩 | 용도 |
| --- | --- | --- | --- |
| `*_외국인 지역별 방문자 수.csv` | 한국관광 데이터랩 → 관광통계 → 지역별(관광 빅데이터). 지역: **시군구** · 구분: **외국인** · 지표: **방문자수** | UTF-8(BOM) | `run_pipeline --datalab-format regional --datalab <이 파일>` — 수요 축 |
| `*_외국인 방문자 거주지(국가).csv` | 위 → 방문자 거주지(**국가별**). 구분: 외국인 | UTF-8(BOM) | `--datalab-country <이 파일>` — 전국 무슬림권 비중 산출 |
| `무슬림 방문자수.csv` | 데이터랩 → 무슬림 방한 방문자수 (대륙·월별) | UTF-8(BOM) | 참고용. 어댑터 미사용 (월별 계절성/총량) |
| `모범음식점정보.csv` | 행안부 모범음식점 지정 현황 ([15155052 파일데이터](https://www.data.go.kr/data/15155052/fileData.do)) | cp949 | `run_pipeline --model-restaurant-csv <이 파일>` — `주된음식종류` → 토큰 매칭 힌트 |
| `../raw/식품_일반음식점.csv` | 행안부 일반음식점 인허가 전국 ([15045016 파일데이터](https://www.data.go.kr/data/15045016/fileData.do), 약 229만행 696MB) | cp949 | `run_pipeline --localdata-format api --localdata <이 파일>` — 공급 축 |

## 전체 실행 (전국 실데이터)

```bash
cd model && source .venv/bin/activate

python -m scripts.run_pipeline \
  --localdata-format api \
  --localdata "data/raw/식품_일반음식점.csv" \
  --model-restaurant-csv "data/real/모범음식점정보.csv" \
  --datalab-format regional \
  --datalab "data/real/20260828160034_외국인 지역별 방문자 수.csv" \
  --datalab-country "data/real/20260828160042_외국인 방문자 거주지(국가).csv"

cd ../plately-web && npm run sync:data --force && git add public/data && git commit
```

전국 end-to-end 약 17초 → `out/{restaurants,region-gap,_meta}.json`.
`restaurants.json` 은 약 4만행(43MB) — 웹에는 `region-gap.json` + `_meta.json` 만 반영,
Explore 식당 목록은 샘플 유지.

`model/out/` 커밋 스냅샷은 **sample 모드** 기준 (CI 재현). regional/api 산출물은
`plately-web/public/data/` 로만 반영하며, 원본 CSV 가 로컬에 있어야 재생성 가능.
