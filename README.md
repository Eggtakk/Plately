# Plately

Plately helps travelers in Korea find restaurants they can actually eat at (pork-free / beef-free), and helps planners see where that supply falls short of demand across the country's 229 시군구. Built for the 2026 한국관광 데이터랩 활용 경진대회.

## [`plately-web/`](./plately-web) — the web app (Next.js)

The traveler-facing Explore mode and the demand–supply-gap Insight dashboard. See [`plately-web/README.md`](./plately-web/README.md).

```bash
cd plately-web
npm install
npm run dev   # http://localhost:3000
```

## Data pipeline (planned)

The Python data pipeline — LOCALDATA filtering to operating pork-free candidates, TourAPI menu cross-check, and the per-시군구 gap-index computation against 데이터랩 visitor demand — will live alongside the app in this repo, mirroring the `dajim/` layout elsewhere in this workspace (`model/` + `docs/`). For now `plately-web` runs entirely on mock data behind the accessor seam described in its README.
