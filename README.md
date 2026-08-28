# Plately

Plately helps travelers in Korea find restaurants they can actually eat at (pork-free / beef-free), and helps planners see where that supply falls short of demand across the country's 229 시군구. Built for the 2026 한국관광 데이터랩 활용 경진대회.

## [`plately-web/`](./plately-web) — the web app (Next.js)

The traveler-facing Explore mode and the demand–supply-gap Insight dashboard. See [`plately-web/README.md`](./plately-web/README.md).

```bash
cd plately-web
npm install
npm run dev   # http://localhost:3000
```

## Data pipeline — [`model/`](./model)

The Python pipeline implementing Notion's 5-stage flow (LOCALDATA filtering →
name-token matching → TourAPI menu cross-check → phone-verification checklist →
per-시군구 gap index against 데이터랩 demand). Mirrors the `dajim/` layout
(`model/` + `docs/`). Runs on hand-authored sample inputs today; real
LOCALDATA / TourAPI / 데이터랩 exports slot in by file replacement
(`--localdata` / `--tourapi-dir` / `--datalab`). Output JSON feeds `plately-web`
via `npm run sync:data`.
