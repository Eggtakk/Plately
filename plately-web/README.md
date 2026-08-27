# Plately — web

Plately is a two-mode web app built for the 2026 한국관광 데이터랩 활용 경진대회. **Explore mode** is a traveler-facing finder for pork-free / beef-free restaurants in Korea — filter by what you avoid, see why each place is listed, and read what's actually inside. **Insight mode** is a demand–supply gap dashboard over Korea's 229 시군구: it overlays Muslim / foreign-visitor demand against the verified pork-free supply and surfaces where the gap is widest, with rankings, a three-region comparison, and a data & method writeup.

## Quickstart

```bash
npm install
npm run dev     # http://localhost:3000  (first run lands on /en/login)
```

## Auth & onboarding

The app gates every non-exempt route on two pieces of `localStorage` state:

- a demo session — `localStorage['plately.session']` (set by `/login`), and
- a completed profile — `localStorage['plately.prefs'].onboarded === true`.

Missing session → redirect to `/login`. Session but not onboarded → redirect into the wizard
(`/onboarding/details` if a profile is already picked, otherwise `/onboarding/profile`).
`/login` and `/onboarding/*` are exempt. The gate lives in
`components/onboarding/OnboardingGate.tsx` (mounted in `app/[locale]/layout.tsx`).

**Flow:** `/login` → `/onboarding/language` → `/onboarding/profile` → `/onboarding/details` → `/explore`.
`/login` accepts any email + password, or "Continue as guest" (a guest session has `email: null`).

**Profiles:**

- **Muslim** — halal-preference tiers: *Halal-certified only* / *Halal meat required* / *Pork & alcohol free* / *Custom*.
- **Hindu** — meat-preference tiers: *Vegetarian* / *No beef* / *No beef/pork* / *No meat* / *Custom*.

Selecting a tier presets the detailed restriction toggles and dims them; choosing **Custom** unlocks
them for free editing. Presets and the profile→restriction map live in `lib/tiers.ts`.

The 14 `RestaurantAttributes` fields drive filtering via `lib/filter.ts`: a restriction excludes a
restaurant only on a **confirmed** conflict — `'unknown'` values pass through and surface in the
restaurant-detail "Your restrictions" block (`components/explore/YourRestrictions.tsx`).

## Explore filtering

The profile's restrictions apply **silently** — Explore has no per-restriction toggles. Above the
chip row a profile-summary pill (`☪️` / `🕉️` + the active tier name, `components/explore/ProfileSummary.tsx`)
links to `/onboarding/details` for adjusting them. The filter chips are **cuisine-only** — *Seafood* /
*Chicken* / *Korean cuisine* — and a chip auto-hides when the profile already restricts that axis
(e.g. no *Seafood* chip once `seafood` is restricted). `ExploreView.tsx` maps active chips to
`RestaurantFilter.cuisines` and merges them with `filterFromPreferences(prefs)`.

**Reset onboarding:** clear `plately.session` + `plately.prefs` from `localStorage`, or call the
hook actions `signOut()` (`lib/useSession.ts`) / `resetOnboarding()` (`lib/usePreferences.ts`).

The old city-picker onboarding at `/start` has been removed.

## Routes

All routes are locale-prefixed: `/[locale]/…` with locales `en ko ar hi`. `ar` renders right-to-left (`dir="rtl"` on `<html>`).

| Route | What it is |
| --- | --- |
| `/[locale]/login` | Demo sign-in — email + password or "Continue as guest" (no TopBar) |
| `/[locale]/onboarding/language` | Wizard step 1 — pick the interface language |
| `/[locale]/onboarding/profile` | Wizard step 2 — pick a diet profile (Muslim / Hindu) |
| `/[locale]/onboarding/details` | Wizard step 3 — preference tier + detailed restriction toggles |
| `/[locale]/explore` | Explore: profile pill + cuisine chips + restaurant list + map |
| `/[locale]/explore/[id]` | Restaurant detail — split layout: why listed / attributes / signature menu beside a location-zoomed map |
| `/[locale]/insight` | Insight: choropleth gap map + region list + region panel |
| `/[locale]/insight/rankings` | Sortable 시군구 gap table |
| `/[locale]/insight/compare` | Three regions side by side, one prescription each |
| `/[locale]/insight/about` | Data sources & pipeline |

## Testing

```bash
npm test          # Vitest — unit + component
npm run e2e        # Playwright — onboarding gate + 4-locale gated smoke + axe accessibility
npm run lint       # ESLint
npm run lint:css   # Stylelint
```

`npm run e2e` starts `npm run dev` itself (see `playwright.config.ts`). The smoke and a11y suites
seed an onboarded guest session (`plately.session` + `plately.prefs`) in a `beforeEach` so gated
routes render; `onboarding.spec.ts` drives the real `/login` → `/onboarding/*` → `/explore` flow.

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
