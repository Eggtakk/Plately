# Plately — web

Plately is a two-mode web app built for the 2026 한국관광 데이터랩 활용 경진대회. **Explore mode** is a traveler-facing finder for pork-free / beef-free restaurants in Korea — filter by what you avoid, see why each place is listed, and read what's actually inside. **Insight mode** is a demand–supply gap dashboard over Korea's 229 시군구: it overlays Muslim / foreign-visitor demand against the verified pork-free supply and surfaces where the gap is widest, with rankings, a three-region comparison, and a data & method writeup.

## Quickstart

```bash
npm install
npm run dev     # http://localhost:3000  (redirects to /en/explore)
```

## Routes

All routes are locale-prefixed: `/[locale]/…` with locales `en ko ar hi`. `ar` renders right-to-left (`dir="rtl"` on `<html>`).

| Route | What it is |
| --- | --- |
| `/[locale]/start` | Onboarding — pick a diet profile and city (no TopBar) |
| `/[locale]/explore` | Explore: filter chips + restaurant list + map |
| `/[locale]/explore/[id]` | Restaurant detail — why listed, attributes, signature menu |
| `/[locale]/insight` | Insight: choropleth gap map + region list + region panel |
| `/[locale]/insight/rankings` | Sortable 시군구 gap table |
| `/[locale]/insight/compare` | Three regions side by side, one prescription each |
| `/[locale]/insight/about` | Data sources & pipeline |

## Testing

```bash
npm test          # Vitest — unit + component (45 tests)
npm run e2e        # Playwright — 4-locale smoke + axe accessibility suite
npm run lint       # ESLint
npm run lint:css   # Stylelint
```

`npm run e2e` starts `npm run dev` itself (see `playwright.config.ts`).

## Data

All data is **mock**. Restaurants (28) live in `lib/mockData.ts`; the 시군구 gap dataset (250 districts) is `public/data/region-gap.json`. The single real-data seam is `lib/filter.ts` plus the `getRestaurants` / `getRestaurant` / `getRegions` / `getRegion` / `getComparisonRegions` accessors in `lib/mockData.ts` — real LOCALDATA / TourAPI / 데이터랩 data slots in behind those without touching any screen code.

### Regenerating data

```bash
bash scripts/build-geojson.sh      # re-download + simplify the 시군구 GeoJSON
node scripts/gen-region-gap.mjs    # regenerate public/data/region-gap.json deterministically from the GeoJSON
```

## i18n

Add a locale: add it to `i18n/routing.ts` and create `messages/<locale>.json` (key-parity with `messages/en.json` is enforced by `lib/i18n.test.ts`). RTL locales are listed in `i18n/routing.ts` as `rtlLocales`.

## Known shortcuts

- `getComparisonRegions()` in `lib/mockData.ts` hardcodes three 시군구 codes: `11030` 용산구 / `21040` 영도구 / `33370` 음성군.
- Region `name.en` currently falls back to the Korean name — the source GeoJSON has no English names.
- Map tiles come from keyless OpenFreeMap (`components/map/mapStyle.ts`).

## Stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · next-intl v4 · maplibre-gl · CSS Modules + design tokens (`styles/tokens.css`).
