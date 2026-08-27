# Plately Detail Map + Chip Cleanup — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Keep a location-zoomed map visible on the restaurant detail page (split layout), and remove profile-restriction filter chips from Explore (replaced by a profile-summary pill), keeping only cuisine discovery chips.

**Architecture:** `/explore/[id]` stays a server route but renders a two-column split (`.panel` scroll + `.mapSlot`); a new `DetailMap` client component wraps `BaseMap` + a single `maplibregl.Marker`. `ExploreView` drops its `loosened`/`restrictionKeys`/`activeRestrictions` machinery — profile restrictions apply silently via `filterFromPreferences(prefs)`; a `ProfileSummary` pill links to `/onboarding/details`. Cuisine chips hide themselves when the profile already restricts that axis.

**Tech Stack:** Next.js 16, React 19, TS, next-intl v4, maplibre-gl, CSS Modules, Vitest, Playwright.

**Spec:** `plately/docs/superpowers/specs/2026-08-27-plately-detail-map-and-chip-cleanup-design.md`
**Base branch:** `plately-detail-map` (off `main`). **Working dir:** `/Users/takyerin/claude/plately/plately-web`. `git add` from inside `plately-web` with relative paths. Every commit ends with a blank line then `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.
**Gates before each commit:** `npm test`, `npx tsc --noEmit`, `npm run lint` (0 errors), `npm run lint:css` (green). `npm run build` at the end.

---

### Task 1: `explore.myProfile` i18n key

**Files:** Modify `messages/{en,ko,ar,hi}.json`

- [ ] **Step 1:** Add to the `explore` object in each catalog: en `"myProfile": "My profile"`, ko `"내 프로필"`, ar `"ملفي الشخصي"`, hi `"मेरी प्रोफ़ाइल"`.
- [ ] **Step 2:** Run `npm test -- i18n` → parity passes.
- [ ] **Step 3:** Commit: `git add messages` → `feat(plately): add explore.myProfile i18n key`

---

### Task 2: `DetailMap` component

**Files:** Create `components/map/DetailMap.tsx`

- [ ] **Step 1: Write `components/map/DetailMap.tsx`**

```tsx
'use client';
import { useRef } from 'react';
import maplibregl from 'maplibre-gl';
import { BaseMap } from './BaseMap';

export function DetailMap({ coords, label }: { coords: [number, number]; label: string }) {
  const markerRef = useRef<maplibregl.Marker | null>(null);
  return (
    <BaseMap
      center={coords}
      zoom={15}
      label={label}
      onReady={(m) => {
        markerRef.current?.remove();
        markerRef.current = new maplibregl.Marker({ color: '#1F6E52' }).setLngLat(coords).addTo(m);
      }}
    />
  );
}
```

- [ ] **Step 2:** Confirm `BaseMap`'s prop type includes `center?: [number, number]`, `zoom?: number`, `label?: string`, `onReady?: (m: MlMap) => void`. It does (from earlier work). If `maplibregl.Marker` type isn't exported as a value type, use `import maplibregl, { Marker } from 'maplibre-gl'` and `useRef<Marker | null>(null)`. Report which.
- [ ] **Step 3:** `npx tsc --noEmit` clean, `npm test` unchanged.
- [ ] **Step 4:** Commit: `git add components/map` → `feat(plately): single-marker DetailMap`

---

### Task 3: Split-layout restaurant detail

**Files:** Modify `app/[locale]/explore/[id]/page.tsx`, rewrite `app/[locale]/explore/[id]/detail.module.css`

- [ ] **Step 1: Rewrite `detail.module.css`**

```css
.view { display: grid; grid-template-columns: minmax(320px, 480px) 1fr; gap: var(--space-4); block-size: calc(100dvh - 64px); padding: var(--space-4) var(--space-6); }
.panel { overflow-y: auto; display: flex; flex-direction: column; gap: var(--space-6); padding-inline-end: var(--space-2); padding-block: var(--space-4); }
.panel .hero h1 { margin: 0; font-size: 24px; }
.panel .hero p { color: var(--ink-soft); margin: var(--space-1) 0 var(--space-2); }
.panel section h2 { font-size: 16px; margin-block: 0 var(--space-2); }
.mapSlot { border: 1px solid var(--line); border-radius: var(--radius-md); overflow: hidden; }

@media (width <= 900px) {
  .view { grid-template-columns: 1fr; block-size: auto; }
  .mapSlot { order: -1; block-size: 40vh; }
}
```

- [ ] **Step 2: Modify `[id]/page.tsx`** — replace the `<article className={styles.wrap}>…</article>` wrapper with:

```tsx
import { DetailMap } from '@/components/map/DetailMap';
// ...
return (
  <div className={styles.view}>
    <article className={styles.panel}>
      <header className={styles.hero}>
        <h1>{r.name[l] ?? r.name.en}</h1>
        <p>{r.area[l] ?? r.area.en} · {r.cuisine}</p>
        <Badge tone={r.confidence}>{tc(r.confidence)}</Badge>
      </header>
      {/* ...keep all existing sections unchanged... */}
      <Callout>{t('disclaimer')}</Callout>
    </article>
    <div className={styles.mapSlot}>
      <DetailMap coords={r.coords} label={r.name[l] ?? r.name.en} />
    </div>
  </div>
);
```

Keep `notFound()`, `getTranslations`, all sections (`whyListed`, `attributes`/`AttributeList`, `YourRestrictionsSlot`, `repMenu`, `Callout`). Only the outer wrapper + the added map column change.

- [ ] **Step 3: Verify** — `npm run build` succeeds. Dev smoke (seed a session so the gate passes): `lsof -ti:3000|xargs kill 2>/dev/null; timeout 70 npm run dev & sleep 30`; throwaway Playwright at `tests/e2e/_dm.spec.ts` (delete after, don't commit):
  ```ts
  import { test, expect } from '@playwright/test';
  test('detail has a map', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('plately.session', JSON.stringify({ email: null, signedInAt: '2026-01-01T00:00:00Z' }));
      localStorage.setItem('plately.prefs', JSON.stringify({ profile: 'muslim', tier: 'pork-alcohol-free', restrictions: { pork: true, alcohol: true, porkDerived: true }, onboarded: true }));
    });
    await page.goto('/en/explore/r-yongsan-samgyetang');
    await expect(page.getByRole('heading', { name: /Samgyetang/ })).toBeVisible();
    await expect(page.locator('[role="application"]')).toBeVisible();
  });
  ```
  Run it, report pass/fail, `rm tests/e2e/_dm.spec.ts` + any `test-results`/`playwright-report`. Kill server.
- [ ] **Step 4:** `npm test` / `tsc` / `lint` / `lint:css` green. Commit: `git add app` → `feat(plately): split-layout restaurant detail with location map`

---

### Task 4: `ProfileSummary` component

**Files:** Create `components/explore/ProfileSummary.tsx` (+ `.module.css`, `.test.tsx`)

- [ ] **Step 1: `components/explore/ProfileSummary.tsx`**

```tsx
'use client';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { usePreferences } from '@/lib/usePreferences';
import type { ProfileKind } from '@/lib/types';
import styles from './ProfileSummary.module.css';

const ICON: Record<ProfileKind, string> = { muslim: '☪️', hindu: '🕉️' };

function TierName({ profile, tier }: { profile: ProfileKind; tier: string }) {
  const t = useTranslations(`tiers.${profile}`);
  return <>{t(tier)}</>;
}

export function ProfileSummary() {
  const te = useTranslations('explore');
  const { prefs, hydrated } = usePreferences();
  if (!hydrated || !prefs.profile || !prefs.tier) return null;
  return (
    <Link href="/onboarding/details" className={styles.pill}>
      <span aria-hidden>{ICON[prefs.profile]}</span>
      <span className={styles.label}>{te('myProfile')}: <TierName profile={prefs.profile} tier={prefs.tier} /></span>
      <span aria-hidden className={styles.chevron}>›</span>
    </Link>
  );
}
```

- [ ] **Step 2: `components/explore/ProfileSummary.module.css`**

```css
.pill { display: inline-flex; align-items: center; gap: var(--space-2); padding: 6px 12px; border: 1px solid var(--line); border-radius: 999px; background: var(--paper-raised); color: var(--ink); text-decoration: none; font-size: 13px; }
.pill:hover { border-color: var(--primary); }
.label { color: var(--ink-soft); }

[dir="rtl"] .chevron { transform: scaleX(-1); }
```

- [ ] **Step 3: `components/explore/ProfileSummary.test.tsx`**

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import messages from '@/messages/en.json';
import { prefsStore } from '@/lib/usePreferences';
import { ProfileSummary } from './ProfileSummary';

// Link mock: render a plain anchor
import { vi } from 'vitest';
vi.mock('@/i18n/navigation', () => ({ Link: (p: any) => <a href={p.href} className={p.className}>{p.children}</a> }));

beforeEach(() => { localStorage.clear(); prefsStore._reset(); });

function withIntl(node: React.ReactNode) {
  return <NextIntlClientProvider locale="en" messages={messages}>{node}</NextIntlClientProvider>;
}

describe('ProfileSummary', () => {
  it('renders nothing without a profile', () => {
    const { container } = render(withIntl(<ProfileSummary />));
    expect(container).toBeEmptyDOMElement();
  });
  it('renders the icon + tier label and links to /onboarding/details', () => {
    localStorage.setItem('plately.prefs', JSON.stringify({ profile: 'muslim', tier: 'pork-alcohol-free', restrictions: {}, onboarded: true }));
    prefsStore._reset();
    render(withIntl(<ProfileSummary />));
    expect(screen.getByText(/Pork & alcohol free/)).toBeInTheDocument();
    expect(screen.getByText('☪️')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/onboarding/details');
  });
});
```

- [ ] **Step 4:** Run `npm test -- ProfileSummary` → 2 passed. If the `prefsStore._reset()` after `setItem` doesn't re-read (cache), the store's `_reset()` clears cache and next `get()` re-reads — should work. Report if not.
- [ ] **Step 5:** Commit: `git add components/explore` → `feat(plately): explore profile-summary pill`

---

### Task 5: Simplify `FilterChips` + rework `ExploreView`

**Files:** Rewrite `components/explore/FilterChips.tsx`, modify `app/[locale]/explore/ExploreView.tsx`

- [ ] **Step 1: Rewrite `components/explore/FilterChips.tsx`**

```tsx
'use client';
import { useTranslations } from 'next-intl';
import styles from './FilterChips.module.css';

export type ExtraChip = 'seafoodCuisine' | 'chickenCuisine' | 'koreanCuisine';

const LABEL_KEY: Record<ExtraChip, 'seafood' | 'chicken' | 'korean'> = {
  seafoodCuisine: 'seafood', chickenCuisine: 'chicken', koreanCuisine: 'korean',
};

export function FilterChips({ extras, activeExtras, onToggleExtra }: {
  extras: ExtraChip[];
  activeExtras: Set<ExtraChip>;
  onToggleExtra: (k: ExtraChip) => void;
}) {
  const tf = useTranslations('filters');
  const te = useTranslations('explore');
  if (extras.length === 0) return null;
  return (
    <div className={styles.row} role="group" aria-label={te('filtersLabel')}>
      {extras.map((k) => (
        <button key={k} type="button" className={styles.chip} data-on={activeExtras.has(k)} aria-pressed={activeExtras.has(k)} onClick={() => onToggleExtra(k)}>
          {tf(LABEL_KEY[k])}
        </button>
      ))}
    </div>
  );
}
```

Keep `FilterChips.module.css` (`.row`, `.chip`, `.chip[data-on="true"]`) unchanged.

- [ ] **Step 2: Modify `ExploreView.tsx`** — apply this diff of intent:
  - Remove imports: `PROFILE_RESTRICTIONS` from `@/lib/tiers`; keep `filterFromPreferences`. `RestrictionKey` still needed for `RESTRICTION_FOR_EXTRA` typing.
  - Add: `import { ProfileSummary } from '@/components/explore/ProfileSummary';`
  - Remove state: `const [loosened, setLoosened] = useState(...)` and its reset `useEffect`.
  - Remove: `restrictionKeys`, `activeRestrictions` useMemo, `onToggleRestriction` handler.
  - New constant near the top of the module:
    ```ts
    const EXTRA_CUISINE: Record<ExtraChip, string> = {
      seafoodCuisine: 'seafood', chickenCuisine: 'korean-chicken', koreanCuisine: 'korean',
    };
    const RESTRICTION_FOR_EXTRA: Partial<Record<ExtraChip, RestrictionKey>> = {
      seafoodCuisine: 'seafood', chickenCuisine: 'chicken',
    };
    const ALL_EXTRAS: ExtraChip[] = ['seafoodCuisine', 'chickenCuisine', 'koreanCuisine'];
    ```
  - Inside the component:
    ```ts
    const shownExtras = ALL_EXTRAS.filter((e) => {
      const r = RESTRICTION_FOR_EXTRA[e];
      return !r || !prefs.restrictions?.[r];
    });
    ```
  - `filter` useMemo:
    ```ts
    const filter = useMemo<RestaurantFilter>(() => {
      const fp = filterFromPreferences(prefs);
      const cuisines = [...extras].map((e) => EXTRA_CUISINE[e]);
      return { ...fp, cuisines: cuisines.length ? cuisines : undefined };
    }, [prefs, extras]);
    ```
  - JSX: in the `.panel` div, render `<ProfileSummary />` first, then `<FilterChips extras={shownExtras} activeExtras={extras} onToggleExtra={(k) => setExtras((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; })} />`, then the count `<p>`, then `<RestaurantList>`.
  - If a previously-active extra chip becomes hidden (profile changed), it can stay in the `extras` Set harmlessly — but add a cleanup effect: `useEffect(() => { setExtras((s) => new Set([...s].filter((e) => shownExtras.includes(e)))); }, [prefs.profile, prefs.tier]);` (guard against infinite loop — deps are profile/tier only, and only shrinks the set).
  - Keep the `<BaseMap>` + `syncPins` + pin-click `router.push` logic unchanged.

- [ ] **Step 3: Verify** — `npm run build` succeeds. `npm test` — the smoke e2e that clicks a `Pork` chip will now fail; Task 6 fixes it, so run `npm test` (vitest only, not e2e) here → green. `tsc`/`lint`/`lint:css` green.

- [ ] **Step 4:** Commit: `git add components/explore app` → `feat(plately): drop profile-restriction chips from explore, keep cuisine chips + profile pill`

---

### Task 6: e2e updates

**Files:** Modify `tests/e2e/smoke.spec.ts` (and `a11y.spec.ts` if needed)

- [ ] **Step 1:** In `smoke.spec.ts`, the seeded prefs in `test.beforeEach` currently use `restrictions: { pork: true, alcohol: true, porkDerived: true }` — keep that (no `seafood`/`chicken`, so those cuisine chips show).
- [ ] **Step 2:** REPLACE the "loosening a restriction chip widens the result count" test with:

```ts
test('a cuisine chip narrows the result count', async ({ page }) => {
  await page.goto('/en/explore');
  const count = page.getByText(/\d+ place/);
  await expect(count).toBeVisible();
  const before = Number((await count.textContent())!.match(/\d+/)![0]);
  const chip = page.getByRole('button', { name: 'Korean cuisine' });
  await chip.click();
  await expect(chip).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(async () => Number((await count.textContent())!.match(/\d+/)![0])).toBeLessThanOrEqual(before);
});
```

- [ ] **Step 3:** ADD a detail-map test:

```ts
test('restaurant detail shows a location map', async ({ page }) => {
  await page.goto('/en/explore/r-yongsan-samgyetang');
  await expect(page.getByRole('heading', { name: /Samgyetang/ })).toBeVisible();
  await expect(page.locator('[role="application"]')).toBeVisible();
});
```

- [ ] **Step 4:** If any other smoke test references a restriction chip label (`Pork`, `Beef`, etc.) as a `button`, update it — the profile-summary pill and cuisine chips are the only chip-like controls now. The `a11y.spec.ts` route list: optionally add `/en/explore/r-yongsan-samgyetang`.
- [ ] **Step 5:** Run `npm run e2e` → all pass. Fix selectors as needed (report each).
- [ ] **Step 6:** Commit: `git add tests` → `test(plately): cuisine-chip + detail-map e2e`

---

### Task 7: README + final verification

**Files:** Modify `plately/plately-web/README.md`

- [ ] **Step 1:** Update the README: restaurant detail now shows a split layout with a location-zoomed map; Explore filter chips are cuisine-only (Seafood/Chicken/Korean cuisine, auto-hidden when the profile restricts that axis) with a profile-summary pill linking to `/onboarding/details` — profile restrictions apply silently.
- [ ] **Step 2:** Full gates: `npm test` (count), `npm run lint` (0), `npm run lint:css` (green), `npx tsc --noEmit` (clean), `npm run build` (route list), `npm run e2e` (all pass). Paste output.
- [ ] **Step 3:** Commit: `git add README.md` → `docs(plately): detail map + explore chip cleanup`

---

## Self-Review

**Spec coverage:** §2 detail split → Tasks 2, 3. §3 FilterChips simplify + ProfileSummary + ExploreView → Tasks 4, 5. §4 i18n → Task 1. §5 tests → Tasks 4 (unit), 6 (e2e). §6 file structure → matches. §7 non-scope respected (no intercepting route, no flyTo, no Halal-certified chip).

**Placeholders:** none. The `[id]/page.tsx` change says "keep all existing sections unchanged" with the full wrapper shown — the implementer has the current file to diff against.

**Type consistency:** `ExtraChip` narrowed to 3 values in Task 5, used consistently in `FilterChips` (Task 5) and `EXTRA_CUISINE`/`RESTRICTION_FOR_EXTRA` (Task 5). `ProfileKind` from `@/lib/types` in Task 4. `filterFromPreferences` return shape `{ restrictions, requireHalalCertified, requireVegetarian }` spread into `filter` in Task 5 — matches its definition. `prefsStore` exported from `@/lib/usePreferences` (added in the store-fix commit) — used in Task 4 test.

---

## Execution Handoff

Proceeding with Subagent-Driven execution (user asked to implement + push).
