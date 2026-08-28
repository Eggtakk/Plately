# data/real/

한국관광 데이터랩 export 원본. **CSV 는 gitignore** (`.gitignore`: `data/real/*.csv`) —
데이터랩에서 재다운로드. 이 README 와 파이프라인 코드만 커밋.

| 파일 | 데이터랩 경로 | 옵션 | 용도 |
| --- | --- | --- | --- |
| `*_외국인 지역별 방문자 수.csv` | 관광통계 → 지역별 (관광 빅데이터) | 지역: 시군구 · 구분: 외국인 · 지표: 방문자수 | `run_pipeline --datalab-format regional --datalab <이 파일>` — 수요 축 |
| `*_외국인 방문자 거주지(국가).csv` | 위 → 방문자 거주지(국가별) | 구분: 외국인 | `--datalab-country <이 파일>` — 전국 무슬림권 비중 산출 |
| `무슬림 방문자수.csv` | 무슬림 방한 방문자수 (대륙·월별) | — | 참고용. 어댑터 미사용 (월별 계절성/총량) |

2026-08-28 다운로드분.

## 실행 (regional 모드)

```bash
cd model
python -m scripts.run_pipeline \
  --datalab-format regional \
  --datalab "data/real/20260828160034_외국인 지역별 방문자 수.csv" \
  --datalab-country "data/real/20260828160042_외국인 방문자 거주지(국가).csv"
cd ../plately-web && npm run sync:data && git add public/data && git commit
```

`model/out/` 커밋 스냅샷은 **sample 모드** 기준 유지 (CI 재현). regional 산출물은
`plately-web/public/data/` 로만 반영 — 원본 CSV 가 로컬에 있어야 재생성 가능.
