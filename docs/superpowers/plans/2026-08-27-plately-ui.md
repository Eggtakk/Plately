# Plately UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Plately frontend — a traveler-facing pork-free/beef-free restaurant finder (Explore mode) plus a 229-시군구 demand–supply gap dashboard (Insight mode) — as a Next.js app with EN/KO/AR/HI localization, RTL support, a calm natural-tone visual system, and a mock-data layer with one real-data seam.

**Architecture:** Next.js 16 App Router with a `[locale]` route segment handled by `next-intl`. Two mode areas (`/explore/*`, `/insight/*`) share only language + theme. All state is client-side: preferences in `localStorage`, locale in cookie + URL. Data comes from typed accessor functions in `lib/mockData.ts`; the single seam for future real data (LOCALDATA / TourAPI / 데이터랩) is `lib/filter.ts` + those accessors. Maps use `maplibre-gl` with keyless OpenFreeMap vector tiles; the Insight choropleth joins gap data into a bundled simplified GeoJSON of the 229 시군구.

**Tech Stack:** Next.js 16, React 19, TypeScript, next-intl v4, maplibre-gl, CSS Modules + design-token CSS variables, Vitest + @testing-library/react, Playwright.

**Spec:** `plately/docs/superpowers/specs/2026-08-27-plately-ui-design.md`

**Working directory for all paths below:** `/Users/takyerin/claude/plately/plately-web` unless stated otherwise.

---

## File Structure

```
plately/
  README.md                                  # Task 29
  plately-web/
    next.config.ts                           # next-intl plugin — Task 1, 4
    middleware.ts                             # locale routing — Task 4
    vitest.config.ts                          # Task 2
    playwright.config.ts                      # Task 2
    i18n/
      routing.ts                              # locales, defaultLocale — Task 4
      request.ts                              # getRequestConfig — Task 4
      navigation.ts                           # Link, useRouter wrappers — Task 4
    messages/
      en.json  ko.json  ar.json  hi.json      # catalogs — Task 5, then per-screen
    app/
      layout.tsx                              # <html> shell, fonts — Task 7
      globals.css                             # token imports, resets — Task 3
      [locale]/
        layout.tsx                            # NextIntlClientProvider, <html dir> — Task 4, 6
        page.tsx                              # redirect → /explore — Task 9
        start/page.tsx                        # onboarding — Task 15, 16
        explore/
          layout.tsx                          # Explore chrome + bottom tabs — Task 9
          page.tsx                            # map + list — Task 18, 19
          [id]/page.tsx                       # restaurant detail — Task 20
        insight/
          layout.tsx                          # Insight chrome — Task 9
          page.tsx                            # gap map — Task 23
          rankings/page.tsx                   # Task 24
          compare/page.tsx                    # Task 25
          about/page.tsx                      # Task 26
    components/
      chrome/TopBar.tsx ModeSwitch.tsx LanguagePicker.tsx ThemeToggle.tsx  # Task 8, 9
      chrome/BottomTabs.tsx                   # Task 9
      map/BaseMap.tsx                         # MapLibre wrapper — Task 17
      map/ChoroplethMap.tsx                   # Task 22
      explore/FilterChips.tsx RestaurantCard.tsx RestaurantList.tsx        # Task 18
      explore/OnboardingCard.tsx              # Task 15
      insight/RegionPanel.tsx RegionList.tsx  # Task 23
      insight/RankingsTable.tsx               # Task 24
      insight/CompareColumn.tsx               # Task 25
      ui/Toggle.tsx Badge.tsx Callout.tsx     # Task 3
    lib/
      types.ts                                # shared types — Task 10
      mockData.ts                             # fixtures + accessors — Task 10, 11
      filter.ts                               # restaurant filter logic — Task 12
      gapScale.ts                             # gap index → color — Task 13
      format.ts                               # Intl helpers — Task 13
      usePreferences.ts                       # localStorage hook — Task 14
      theme.ts                                # theme get/set/apply — Task 3
    public/
      sigungu.simplified.geojson             # Task 21
      data/region-gap.json                   # generated 229 rows — Task 11
    styles/
      tokens.css                              # color/space/radius vars — Task 3
    tests/
      e2e/smoke.spec.ts                       # Task 27
      e2e/a11y.spec.ts                        # Task 28
```

---

## Phase 0 — Scaffolding

### Task 1: Create the Next.js app

**Files:**
- Create: `plately/plately-web/` (whole app via generator)
- Modify: `plately/plately-web/package.json`

- [ ] **Step 1: Generate the app**

Run from `/Users/takyerin/claude/plately`:

```bash
npx create-next-app@latest plately-web \
  --ts --app --eslint --no-tailwind --no-src-dir --import-alias "@/*" --use-npm
```

Expected: `plately-web/` created with `app/`, `next.config.ts`, `tsconfig.json`.

- [ ] **Step 2: Pin runtime deps to match the monorepo sibling**

Run from `plately/plately-web`:

```bash
npm install next@16.3.0 react@19.2.8 react-dom@19.2.8
npm install next-intl@^4 maplibre-gl@^5
npm install -D vitest@^3 @vitejs/plugin-react@^5 jsdom@^25 \
  @testing-library/react@^16 @testing-library/jest-dom@^6 \
  @playwright/test@^1 @axe-core/playwright@^4
npx playwright install chromium
```

Expected: all install without peer-dep errors.

- [ ] **Step 3: Add scripts**

In `package.json` `"scripts"`, ensure:

```json
{
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint",
  "test": "vitest run",
  "test:watch": "vitest",
  "e2e": "playwright test"
}
```

- [ ] **Step 4: Smoke the dev server**

Run: `npm run dev` then in another shell `curl -sI http://localhost:3000 | head -1`
Expected: `HTTP/1.1 200 OK`. Stop the server.

- [ ] **Step 5: Commit**

```bash
cd /Users/takyerin/claude
git add claude/plately/plately-web 2>/dev/null || git add plately/plately-web
git commit -m "chore(plately): scaffold Next.js app"
```

> Note: the git root is `/Users/takyerin`; the app path from root is `claude/plately/plately-web`. All later commits use `git -C /Users/takyerin` implicitly via running `git add` from `/Users/takyerin/claude`. Adjust if the repo layout differs.

---

### Task 2: Testing setup

**Files:**
- Create: `vitest.config.ts`, `vitest.setup.ts`, `playwright.config.ts`
- Create: `lib/__tests__/sanity.test.ts`

- [ ] **Step 1: Write `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
    include: ['lib/**/*.test.{ts,tsx}', 'components/**/*.test.{ts,tsx}'],
  },
  resolve: { alias: { '@': resolve(__dirname, '.') } },
});
```

- [ ] **Step 2: Write `vitest.setup.ts`**

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 3: Write `playwright.config.ts`**

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  use: { baseURL: 'http://localhost:3000' },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```

- [ ] **Step 4: Write the sanity test `lib/__tests__/sanity.test.ts`**

```ts
import { describe, it, expect } from 'vitest';

describe('test harness', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Run it**

Run: `npm test`
Expected: 1 passed.

- [ ] **Step 6: Commit**

```bash
cd /Users/takyerin/claude && git add plately/plately-web && git commit -m "chore(plately): add vitest + playwright setup"
```

---

### Task 3: Design tokens, theme system, UI atoms

**Files:**
- Create: `styles/tokens.css`, `lib/theme.ts`, `lib/theme.test.ts`
- Create: `components/ui/Toggle.tsx`, `components/ui/Badge.tsx`, `components/ui/Callout.tsx`
- Modify: `app/globals.css`

- [ ] **Step 1: Write `styles/tokens.css`** (values from spec §4.1–4.3)

```css
:root {
  --paper: #FBF8F3;
  --paper-raised: #FFFFFF;
  --ink: #1E1B16;
  --ink-soft: rgba(30, 27, 22, 0.60);
  --primary: #1F6E52;
  --primary-contrast: #FFFFFF;
  --accent: #C56B4A;
  --line: #E4DCCB;
  --focus: #1F6E52;

  --gap-low: #1F6E52;    /* low gap  */
  --gap-mid: #E0A458;    /* amber    */
  --gap-high: #B4472E;   /* deep clay*/

  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --space-1: 4px; --space-2: 8px; --space-3: 12px; --space-4: 16px;
  --space-6: 24px; --space-8: 32px; --space-12: 48px;
  --shadow-1: 0 1px 2px rgba(30,27,22,0.06), 0 2px 8px rgba(30,27,22,0.06);
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --paper: #16130F;
    --paper-raised: #211D17;
    --ink: #F1ECE1;
    --ink-soft: rgba(241, 236, 225, 0.62);
    --primary: #5FBF9B;
    --primary-contrast: #10231C;
    --accent: #D98A6A;
    --line: rgba(241, 236, 225, 0.16);
    --focus: #5FBF9B;
    --shadow-1: 0 1px 2px rgba(0,0,0,0.4), 0 2px 10px rgba(0,0,0,0.4);
  }
}

:root[data-theme="dark"] {
  --paper: #16130F; --paper-raised: #211D17; --ink: #F1ECE1;
  --ink-soft: rgba(241,236,225,0.62); --primary: #5FBF9B;
  --primary-contrast: #10231C; --accent: #D98A6A;
  --line: rgba(241,236,225,0.16); --focus: #5FBF9B;
  --shadow-1: 0 1px 2px rgba(0,0,0,0.4), 0 2px 10px rgba(0,0,0,0.4);
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.001ms !important; transition-duration: 0.001ms !important; }
}
```

- [ ] **Step 2: Rewrite `app/globals.css`**

```css
@import "../styles/tokens.css";

* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  background: var(--paper);
  color: var(--ink);
  font-family: var(--font-sans, system-ui, sans-serif);
  -webkit-font-smoothing: antialiased;
}
a { color: inherit; }
:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; border-radius: 4px; }
button { font: inherit; }
.tnum { font-variant-numeric: tabular-nums; }
```

- [ ] **Step 3: Write `lib/theme.ts`**

```ts
export type Theme = 'light' | 'dark' | 'system';
const KEY = 'plately.theme';

export function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'system';
  const v = window.localStorage.getItem(KEY);
  return v === 'light' || v === 'dark' ? v : 'system';
}

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
}

export function setTheme(theme: Theme): void {
  if (theme === 'system') window.localStorage.removeItem(KEY);
  else window.localStorage.setItem(KEY, theme);
  applyTheme(theme);
}
```

- [ ] **Step 4: Write `lib/theme.test.ts`**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { getStoredTheme, setTheme, applyTheme } from './theme';

beforeEach(() => { localStorage.clear(); document.documentElement.removeAttribute('data-theme'); });

describe('theme', () => {
  it('defaults to system', () => { expect(getStoredTheme()).toBe('system'); });
  it('persists an explicit theme', () => { setTheme('dark'); expect(getStoredTheme()).toBe('dark'); });
  it('applies data-theme attribute', () => {
    applyTheme('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });
  it('system removes the attribute', () => {
    applyTheme('dark'); applyTheme('system');
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });
});
```

- [ ] **Step 5: Run** `npm test -- theme` — Expected: 4 passed.

- [ ] **Step 6: Write UI atoms**

`components/ui/Badge.tsx`:

```tsx
import styles from './Badge.module.css';

type Tone = 'phone' | 'menu' | 'name' | 'neutral';
export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: React.ReactNode }) {
  return <span className={styles.badge} data-tone={tone}>{children}</span>;
}
```

`components/ui/Badge.module.css`:

```css
.badge {
  display: inline-flex; align-items: center; gap: var(--space-1);
  padding: 2px 8px; border-radius: 999px; font-size: 12px; font-weight: 600;
  border: 1px solid var(--line); color: var(--ink-soft);
}
.badge[data-tone="phone"] { color: var(--primary); border-color: var(--primary); }
.badge[data-tone="menu"]  { color: var(--accent);  border-color: var(--accent); }
```

`components/ui/Toggle.tsx`:

```tsx
'use client';
import styles from './Toggle.module.css';

export function Toggle({ checked, onChange, label }: {
  checked: boolean; onChange: (v: boolean) => void; label: string;
}) {
  return (
    <button
      type="button" role="switch" aria-checked={checked}
      className={styles.toggle} data-on={checked}
      onClick={() => onChange(!checked)}
    >
      <span className={styles.knob} aria-hidden />
      <span className={styles.label}>{label}</span>
    </button>
  );
}
```

`components/ui/Toggle.module.css`:

```css
.toggle { display: inline-flex; align-items: center; gap: var(--space-2); background: none; border: 0; cursor: pointer; padding: var(--space-1); }
.toggle .knob { inline-size: 40px; block-size: 24px; border-radius: 999px; background: var(--line); position: relative; transition: background .15s; }
.toggle .knob::after { content: ""; position: absolute; inset-block-start: 2px; inset-inline-start: 2px; inline-size: 20px; block-size: 20px; border-radius: 999px; background: var(--paper-raised); transition: transform .15s; }
.toggle[data-on="true"] .knob { background: var(--primary); }
.toggle[data-on="true"] .knob::after { transform: translateX(16px); }
[dir="rtl"] .toggle[data-on="true"] .knob::after { transform: translateX(-16px); }
.label { font-size: 14px; }
```

`components/ui/Callout.tsx`:

```tsx
import styles from './Callout.module.css';
export function Callout({ children }: { children: React.ReactNode }) {
  return <p className={styles.callout}>{children}</p>;
}
```

`components/ui/Callout.module.css`:

```css
.callout { border-inline-start: 3px solid var(--accent); background: var(--paper-raised); padding: var(--space-3) var(--space-4); border-radius: var(--radius-sm); font-size: 13px; color: var(--ink-soft); margin: 0; }
```

- [ ] **Step 7: Commit**

```bash
cd /Users/takyerin/claude && git add plately/plately-web && git commit -m "feat(plately): design tokens, theme system, UI atoms"
```

---

## Phase 1 — i18n foundation

### Task 4: next-intl routing + middleware + provider

**Files:**
- Create: `i18n/routing.ts`, `i18n/request.ts`, `i18n/navigation.ts`, `middleware.ts`
- Modify: `next.config.ts`
- Create: `app/[locale]/layout.tsx`, `app/[locale]/page.tsx`
- Delete: `app/page.tsx` (generator default)

- [ ] **Step 1: `i18n/routing.ts`**

```ts
import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['en', 'ko', 'ar', 'hi'],
  defaultLocale: 'en',
  localePrefix: 'always',
});

export type Locale = (typeof routing.locales)[number];
export const rtlLocales: Locale[] = ['ar'];
export const dirFor = (l: Locale) => (rtlLocales.includes(l) ? 'rtl' : 'ltr');
```

- [ ] **Step 2: `i18n/navigation.ts`**

```ts
import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
```

- [ ] **Step 3: `i18n/request.ts`**

```ts
import { getRequestConfig } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
```

- [ ] **Step 4: `middleware.ts`**

```ts
import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

export default createMiddleware(routing);

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
```

- [ ] **Step 5: `next.config.ts`**

```ts
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const nextConfig: NextConfig = {};

export default withNextIntl(nextConfig);
```

- [ ] **Step 6: `app/[locale]/layout.tsx`**

```tsx
import { notFound } from 'next/navigation';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { routing, dirFor, type Locale } from '@/i18n/routing';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <div lang={locale} dir={dirFor(locale as Locale)} data-locale={locale}>
      <NextIntlClientProvider>{children}</NextIntlClientProvider>
    </div>
  );
}
```

> `<html>` `lang`/`dir` are set in Task 6 via the root layout reading the segment; this wrapper `<div dir>` guarantees correct direction for nested content even before that.

- [ ] **Step 7: `app/[locale]/page.tsx`**

```tsx
import { redirect } from '@/i18n/navigation';

export default async function LocaleIndex({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect({ href: '/explore', locale });
}
```

- [ ] **Step 8: Delete `app/page.tsx`** (the generator's default home).

Run: `rm app/page.tsx`

- [ ] **Step 9: Create placeholder `messages/en.json`** so imports resolve:

```json
{ "meta": { "appName": "Plately" } }
```

Copy it to `ko.json`, `ar.json`, `hi.json` for now.

Run: `for l in ko ar hi; do cp messages/en.json messages/$l.json; done`

- [ ] **Step 10: Verify routing**

Run: `npm run dev`, then:

```bash
curl -sI http://localhost:3000/ | grep -i location        # → /en
curl -sI http://localhost:3000/en | grep -i location      # → /en/explore
curl -s -H 'Accept-Language: ko' -I http://localhost:3000/ | grep -i location  # → /ko
```

Expected: redirects as noted. Stop the server.

- [ ] **Step 11: Commit**

```bash
cd /Users/takyerin/claude && git add plately/plately-web && git commit -m "feat(plately): next-intl locale routing + middleware"
```

---

### Task 5: Message catalog skeleton

**Files:**
- Modify: `messages/en.json`, `messages/ko.json`, `messages/ar.json`, `messages/hi.json`
- Create: `lib/i18n.test.ts`

- [ ] **Step 1: Write `messages/en.json`** with the full top-level key structure (screens fill values later):

```json
{
  "meta": { "appName": "Plately", "tagline": "Places you can eat, mapped." },
  "nav": { "explore": "Explore", "insight": "Insight", "restart": "Restart", "about": "About" },
  "theme": { "light": "Light", "dark": "Dark", "system": "System" },
  "language": { "label": "Language" },
  "onboarding": {
    "step1Title": "What do you avoid?",
    "muslim": "Muslim", "muslimDesc": "No pork",
    "hindu": "Hindu", "hinduDesc": "No beef",
    "porkfree": "Just pork-free",
    "custom": "Custom",
    "alcoholToggle": "Also avoid alcohol served on-site",
    "vegToggle": "Vegetarian only",
    "step2Title": "Where are you?",
    "nearMe": "Near me",
    "skip": "Skip", "next": "Next", "done": "See restaurants"
  },
  "filters": {
    "porkFree": "Pork-free", "alcoholFree": "Alcohol-free", "vegetarian": "Vegetarian",
    "beefFree": "Beef-free", "seafood": "Seafood", "chicken": "Chicken",
    "korean": "Korean cuisine", "halalCertified": "Halal-certified"
  },
  "confidence": { "phone": "Phone-verified", "menu": "Menu-checked", "name": "Name-inferred" },
  "restaurant": {
    "whyListed": "Why it's listed",
    "matchedTokens": "Name signals", "menuChecked": "Menu text checked", "phoneVerified": "Phone-verified on {date}",
    "attributes": "What's inside", "containsPork": "Contains pork", "servesAlcohol": "Serves alcohol",
    "containsBeef": "Contains beef", "vegetarianFriendly": "Vegetarian options",
    "repMenu": "Signature menu", "directions": "Directions", "call": "Call", "copyAddress": "Copy address",
    "disclaimer": "Always confirm with the restaurant. Broth and seasoning may contain pork even when the menu name doesn't say so.",
    "yes": "Yes", "no": "No", "unknown": "Unknown"
  },
  "insight": {
    "gapMap": "Gap map", "rankings": "Rankings", "compare": "Three regions", "about": "Data & method",
    "demand": "Demand", "supply": "Supply", "gapIndex": "Gap index", "trend": "Trend vs 2019",
    "layerGap": "Gap index", "layerDemand": "Demand", "layerSupply": "Supply", "layerCandidates": "Candidate density",
    "regionListLabel": "Regions by gap index",
    "topCandidates": "Top candidate restaurants",
    "compareIntro": "Same country, three different prescriptions.",
    "saturated": "Saturated", "growing": "Growing, underserved", "empty": "Empty",
    "prescription": "Prescription"
  },
  "common": { "back": "Back", "close": "Close", "loading": "Loading", "of229": "of 229 시군구" }
}
```

- [ ] **Step 2: Translate into `ko.json`** — full values (native Korean).

- [ ] **Step 3: Translate into `ar.json`** — full UI values in Arabic. Numerals in body copy may stay as written; interpolated `{date}` handled by formatter.

- [ ] **Step 4: Translate into `hi.json`** — full UI values in Hindi (Devanagari).

- [ ] **Step 5: Write `lib/i18n.test.ts`** — guard against key drift:

```ts
import { describe, it, expect } from 'vitest';
import en from '@/messages/en.json';
import ko from '@/messages/ko.json';
import ar from '@/messages/ar.json';
import hi from '@/messages/hi.json';

function keys(obj: unknown, prefix = ''): string[] {
  if (obj && typeof obj === 'object') {
    return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
      keys(v, prefix ? `${prefix}.${k}` : k),
    );
  }
  return [prefix];
}

describe('message catalogs', () => {
  const base = keys(en).sort();
  it.each([['ko', ko], ['ar', ar], ['hi', hi]] as const)('%s has the same keys as en', (_name, cat) => {
    expect(keys(cat).sort()).toEqual(base);
  });
});
```

- [ ] **Step 6: Run** `npm test -- i18n` — Expected: 3 passed.

- [ ] **Step 7: Commit**

```bash
cd /Users/takyerin/claude && git add plately/plately-web && git commit -m "feat(plately): message catalog skeleton for en/ko/ar/hi"
```

---

### Task 6: RTL — root `<html lang dir>` + logical-property guard

**Files:**
- Create: `app/layout.tsx` (root, minimal)
- Modify: `app/[locale]/layout.tsx` (move `dir` to `<html>` via `params`)
- Create: `eslint.config.mjs` rule addition
- Create: `lib/dir.test.ts`

- [ ] **Step 1: Root `app/layout.tsx`**

```tsx
import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Plately' };

// The [locale] layout renders <html>; this root only carries global CSS.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
```

> Next.js requires `<html>`/`<body>` somewhere. Render them in `app/[locale]/layout.tsx` instead so `lang`/`dir` are per-locale.

- [ ] **Step 2: Update `app/[locale]/layout.tsx`** to render the document shell:

```tsx
import { notFound } from 'next/navigation';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { routing, dirFor, type Locale } from '@/i18n/routing';
import { fontClass } from '@/app/fonts';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children, params,
}: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <html lang={locale} dir={dirFor(locale as Locale)} className={fontClass(locale as Locale)}>
      <body>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Add the lint guard** in `eslint.config.mjs` — forbid physical margin/padding/position props in CSS Modules is not lintable via eslint; instead add a `stylelint` check. Install and configure:

```bash
npm install -D stylelint stylelint-config-standard stylelint-use-logical
```

`.stylelintrc.json`:

```json
{
  "extends": ["stylelint-config-standard"],
  "plugins": ["stylelint-use-logical"],
  "rules": {
    "csstools/use-logical": "always",
    "selector-class-pattern": null,
    "custom-property-empty-line-before": null
  }
}
```

Add script to `package.json`: `"lint:css": "stylelint \"**/*.css\""`

- [ ] **Step 4: `lib/dir.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { dirFor } from '@/i18n/routing';

describe('dirFor', () => {
  it('ar is rtl', () => expect(dirFor('ar')).toBe('rtl'));
  it('en/ko/hi are ltr', () => {
    expect(dirFor('en')).toBe('ltr');
    expect(dirFor('ko')).toBe('ltr');
    expect(dirFor('hi')).toBe('ltr');
  });
});
```

- [ ] **Step 5: Run** `npm test -- dir` — Expected: 2 passed.

- [ ] **Step 6: Commit**

```bash
cd /Users/takyerin/claude && git add plately/plately-web && git commit -m "feat(plately): per-locale <html lang dir> + logical-property lint guard"
```

---

### Task 7: Fonts

**Files:**
- Create: `app/fonts.ts`

- [ ] **Step 1: Write `app/fonts.ts`**

```ts
import { Noto_Sans, Noto_Sans_KR, Noto_Sans_Arabic, Noto_Sans_Devanagari } from 'next/font/google';
import type { Locale } from '@/i18n/routing';

const latin = Noto_Sans({ subsets: ['latin'], variable: '--font-latin', display: 'swap' });
const korean = Noto_Sans_KR({ subsets: ['latin'], variable: '--font-korean', display: 'swap' });
const arabic = Noto_Sans_Arabic({ subsets: ['arabic'], variable: '--font-arabic', display: 'swap' });
const devanagari = Noto_Sans_Devanagari({ subsets: ['devanagari'], variable: '--font-devanagari', display: 'swap' });

const all = `${latin.variable} ${korean.variable} ${arabic.variable} ${devanagari.variable}`;

const stackByLocale: Record<Locale, string> = {
  en: 'var(--font-latin)',
  ko: 'var(--font-korean), var(--font-latin)',
  ar: 'var(--font-arabic), var(--font-latin)',
  hi: 'var(--font-devanagari), var(--font-latin)',
};

export function fontClass(locale: Locale): string {
  return all;
}
export function fontFamily(locale: Locale): string {
  return `${stackByLocale[locale]}, system-ui, sans-serif`;
}
```

- [ ] **Step 2: Wire `--font-sans`** — in `app/[locale]/layout.tsx` `<body>`, add `style={{ ['--font-sans' as string]: fontFamily(locale as Locale) }}`.

- [ ] **Step 3: Verify** — Run `npm run dev`, open `http://localhost:3000/ar/explore`, confirm no font 404s in the network tab (page will still be sparse). Stop server.

- [ ] **Step 4: Commit**

```bash
cd /Users/takyerin/claude && git add plately/plately-web && git commit -m "feat(plately): localized font stacks via next/font"
```

---

### Task 8: LanguagePicker + ThemeToggle

**Files:**
- Create: `components/chrome/LanguagePicker.tsx` (+ `.module.css`)
- Create: `components/chrome/ThemeToggle.tsx` (+ `.module.css`)
- Create: `components/chrome/ThemeScript.tsx`
- Create: `components/chrome/LanguagePicker.test.tsx`

- [ ] **Step 1: `components/chrome/ThemeScript.tsx`** — blocking script to avoid flash:

```tsx
export function ThemeScript() {
  const js = `(function(){try{var t=localStorage.getItem('plately.theme');if(t==='dark'||t==='light')document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;
  return <script dangerouslySetInnerHTML={{ __html: js }} />;
}
```

Add `<ThemeScript />` in `<head>` of `app/[locale]/layout.tsx` (inside `<html>`, before `<body>`).

- [ ] **Step 2: `components/chrome/ThemeToggle.tsx`**

```tsx
'use client';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { getStoredTheme, setTheme, type Theme } from '@/lib/theme';
import styles from './ThemeToggle.module.css';

const order: Theme[] = ['system', 'light', 'dark'];

export function ThemeToggle() {
  const t = useTranslations('theme');
  const [theme, setLocal] = useState<Theme>('system');
  useEffect(() => setLocal(getStoredTheme()), []);

  function cycle() {
    const next = order[(order.indexOf(theme) + 1) % order.length];
    setTheme(next);
    setLocal(next);
  }
  return (
    <button type="button" className={styles.btn} onClick={cycle} aria-label={`${t(theme)}`}>
      {theme === 'dark' ? '◑' : theme === 'light' ? '☀' : '◐'}
    </button>
  );
}
```

`ThemeToggle.module.css`:

```css
.btn { background: none; border: 1px solid var(--line); border-radius: 999px; inline-size: 34px; block-size: 34px; cursor: pointer; color: var(--ink); }
```

- [ ] **Step 3: `components/chrome/LanguagePicker.tsx`**

```tsx
'use client';
import { useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import styles from './LanguagePicker.module.css';

const NATIVE: Record<string, string> = { en: 'English', ko: '한국어', ar: 'العربية', hi: 'हिन्दी' };

export function LanguagePicker() {
  const t = useTranslations('language');
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <label className={styles.wrap}>
      <span className="sr-only">{t('label')}</span>
      <select
        className={styles.select}
        value={locale}
        disabled={pending}
        onChange={(e) => startTransition(() => router.replace(pathname, { locale: e.target.value }))}
      >
        {routing.locales.map((l) => (
          <option key={l} value={l}>{NATIVE[l]}</option>
        ))}
      </select>
    </label>
  );
}
```

`LanguagePicker.module.css`:

```css
.wrap { display: inline-flex; }
.select { font: inherit; padding: 6px 10px; border-radius: 999px; border: 1px solid var(--line); background: var(--paper-raised); color: var(--ink); }
```

Add `.sr-only` to `globals.css`:

```css
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
```

- [ ] **Step 4: `components/chrome/LanguagePicker.test.tsx`**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import messages from '@/messages/en.json';

vi.mock('@/i18n/navigation', () => ({
  usePathname: () => '/explore',
  useRouter: () => ({ replace: vi.fn() }),
}));

import { LanguagePicker } from './LanguagePicker';

describe('LanguagePicker', () => {
  it('renders all four locales with native names', () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <LanguagePicker />
      </NextIntlClientProvider>,
    );
    const options = screen.getAllByRole('option').map((o) => o.textContent);
    expect(options).toEqual(['English', '한국어', 'العربية', 'हिन्दी']);
  });
});
```

- [ ] **Step 5: Run** `npm test -- LanguagePicker` — Expected: 1 passed.

- [ ] **Step 6: Commit**

```bash
cd /Users/takyerin/claude && git add plately/plately-web && git commit -m "feat(plately): language picker + theme toggle"
```

---

### Task 9: Shared chrome — TopBar, ModeSwitch, layouts, BottomTabs

**Files:**
- Create: `components/chrome/TopBar.tsx` (+ css), `components/chrome/ModeSwitch.tsx` (+ css), `components/chrome/BottomTabs.tsx` (+ css)
- Create: `app/[locale]/explore/layout.tsx`, `app/[locale]/insight/layout.tsx`

- [ ] **Step 1: `components/chrome/ModeSwitch.tsx`**

```tsx
'use client';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import styles from './ModeSwitch.module.css';

export function ModeSwitch() {
  const t = useTranslations('nav');
  const path = usePathname();
  const mode = path.startsWith('/insight') ? 'insight' : 'explore';
  return (
    <div className={styles.seg} role="tablist" aria-label="Mode">
      <Link href="/explore" className={styles.tab} data-active={mode === 'explore'} role="tab" aria-selected={mode === 'explore'}>{t('explore')}</Link>
      <Link href="/insight" className={styles.tab} data-active={mode === 'insight'} role="tab" aria-selected={mode === 'insight'}>{t('insight')}</Link>
    </div>
  );
}
```

`ModeSwitch.module.css`:

```css
.seg { display: inline-flex; gap: 2px; padding: 3px; background: var(--line); border-radius: 999px; }
.tab { padding: 6px 16px; border-radius: 999px; font-size: 14px; font-weight: 600; color: var(--ink-soft); text-decoration: none; }
.tab[data-active="true"] { background: var(--paper-raised); color: var(--ink); box-shadow: var(--shadow-1); }
```

- [ ] **Step 2: `components/chrome/TopBar.tsx`**

```tsx
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { ModeSwitch } from './ModeSwitch';
import { LanguagePicker } from './LanguagePicker';
import { ThemeToggle } from './ThemeToggle';
import styles from './TopBar.module.css';

export async function TopBar() {
  const t = await getTranslations('meta');
  return (
    <header className={styles.bar}>
      <Link href="/explore" className={styles.brand}>{t('appName')}</Link>
      <div className={styles.center}><ModeSwitch /></div>
      <div className={styles.actions}>
        <LanguagePicker />
        <ThemeToggle />
      </div>
    </header>
  );
}
```

`TopBar.module.css`:

```css
.bar { display: flex; align-items: center; gap: var(--space-4); padding: var(--space-3) var(--space-6); border-block-end: 1px solid var(--line); background: var(--paper); position: sticky; inset-block-start: 0; z-index: 10; }
.brand { font-weight: 800; font-size: 18px; text-decoration: none; }
.center { margin-inline: auto; }
.actions { display: flex; align-items: center; gap: var(--space-2); }
@media (max-width: 640px) { .center { order: 3; flex-basis: 100%; display: flex; justify-content: center; } }
```

- [ ] **Step 3: `components/chrome/BottomTabs.tsx`** (Explore, mobile only)

```tsx
'use client';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import styles from './BottomTabs.module.css';

export function BottomTabs() {
  const t = useTranslations('nav');
  const path = usePathname();
  const items = [
    { href: '/explore', label: t('explore') },
    { href: '/start', label: t('restart') },
    { href: '/insight/about', label: t('about') },
  ];
  return (
    <nav className={styles.tabs} aria-label="Primary">
      {items.map((i) => (
        <Link key={i.href} href={i.href} className={styles.tab} data-active={path.startsWith(i.href)}>{i.label}</Link>
      ))}
    </nav>
  );
}
```

`BottomTabs.module.css`:

```css
.tabs { display: none; }
@media (max-width: 640px) {
  .tabs { display: flex; position: fixed; inset-block-end: 0; inset-inline: 0; background: var(--paper-raised); border-block-start: 1px solid var(--line); }
  .tab { flex: 1; text-align: center; padding: var(--space-3); font-size: 12px; text-decoration: none; color: var(--ink-soft); }
  .tab[data-active="true"] { color: var(--primary); font-weight: 700; }
}
```

- [ ] **Step 4: `app/[locale]/explore/layout.tsx`**

```tsx
import { setRequestLocale } from 'next-intl/server';
import { TopBar } from '@/components/chrome/TopBar';
import { BottomTabs } from '@/components/chrome/BottomTabs';

export default async function ExploreLayout({
  children, params,
}: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <>
      <TopBar />
      <main>{children}</main>
      <BottomTabs />
    </>
  );
}
```

- [ ] **Step 5: `app/[locale]/insight/layout.tsx`** — same but no `BottomTabs`.

- [ ] **Step 6: Temp pages** so routes resolve: create `app/[locale]/explore/page.tsx`, `app/[locale]/insight/page.tsx`, `app/[locale]/start/page.tsx` each returning `<p>placeholder</p>` (replaced in later tasks).

- [ ] **Step 7: Verify** — `npm run dev`, visit `/en/explore` and `/ar/insight`; confirm TopBar renders, mode switch highlights correctly, Arabic layout is RTL (brand on the right). Stop server.

- [ ] **Step 8: Commit**

```bash
cd /Users/takyerin/claude && git add plately/plately-web && git commit -m "feat(plately): shared chrome (top bar, mode switch, bottom tabs, layouts)"
```

---

## Phase 2 — Data layer

### Task 10: Types + restaurant mock data

**Files:**
- Create: `lib/types.ts`, `lib/mockData.ts`, `lib/mockData.test.ts`

- [ ] **Step 1: `lib/types.ts`** (verbatim from spec §6.2, plus filter/detail types)

```ts
export type Locale = 'en' | 'ko' | 'ar' | 'hi';
export type LocalizedName = { en: string; ko: string; ar?: string; hi?: string };

export type Confidence = 'phone' | 'menu' | 'name';
export type Tristate = boolean | 'unknown';

export interface RestaurantAttributes {
  containsPork: boolean;
  servesAlcohol: Tristate;
  containsBeef: boolean;
  vegetarianFriendly: boolean;
}

export interface Restaurant {
  id: string;
  name: LocalizedName;
  area: LocalizedName;
  sigunguCode: string;
  coords: [number, number]; // [lng, lat]
  cuisine: string;
  attributes: RestaurantAttributes;
  confidence: Confidence;
  matchedTokens: string[];
  repMenu: string[];
  phoneVerifiedOn?: string; // ISO date
}

export interface RegionGap {
  code: string;
  name: LocalizedName;
  gwangyeok: string;
  demandScore: number;   // 0..100
  supplyCount: number;
  gapIndex: number;      // 0..100
  trendVs2019: number;   // percent
}

export interface RegionGapDetail extends RegionGap {
  topCandidateIds: string[];
  processingStatus: 'pipeline' | 'menu-checked' | 'phone-sampled';
}

export interface Preferences {
  profile: 'muslim' | 'hindu' | 'porkfree' | 'custom';
  avoidPork: boolean;
  avoidAlcohol: boolean;
  avoidBeef: boolean;
  vegetarianOnly: boolean;
  city?: string;
}

export interface RestaurantFilter {
  avoidPork?: boolean;
  avoidAlcohol?: boolean;
  avoidBeef?: boolean;
  vegetarianOnly?: boolean;
  cuisines?: string[];
  sigunguCode?: string;
}
```

- [ ] **Step 2: `lib/mockData.ts`** — hand-write **at least 24** restaurants spanning Seoul (용산/마포), Busan, Incheon, Jeju, and 2–3 gap regions. Include a spread of `confidence`, `servesAlcohol: 'unknown'`, and both pork-free Korean (삼계탕/횟집/한우) and Muslim-cuisine venues. Skeleton:

```ts
import type { Restaurant, RegionGap, RegionGapDetail, RestaurantFilter } from './types';
import regionGapJson from '@/public/data/region-gap.json';
import { applyRestaurantFilter } from './filter';

export const RESTAURANTS: Restaurant[] = [
  {
    id: 'r-seoul-samgyetang-1',
    name: { en: 'Tosokchon Samgyetang', ko: '토속촌 삼계탕', ar: 'توسوكشون سامجيتانج', hi: 'टोसोकचॉन सामग्येतांग' },
    area: { en: 'Jongno, Seoul', ko: '서울 종로' },
    sigunguCode: '11110', coords: [126.9709, 37.5793], cuisine: 'korean-chicken',
    attributes: { containsPork: false, servesAlcohol: false, containsBeef: false, vegetarianFriendly: false },
    confidence: 'phone', phoneVerifiedOn: '2026-08-20',
    matchedTokens: ['삼계탕'], repMenu: ['삼계탕', '전복삼계탕'],
  },
  // ... 23+ more, following the same shape
];

export function getRestaurants(filter: RestaurantFilter = {}): Restaurant[] {
  return applyRestaurantFilter(RESTAURANTS, filter);
}

export function getRestaurant(id: string): Restaurant | undefined {
  return RESTAURANTS.find((r) => r.id === id);
}

export function getRegions(): RegionGap[] {
  return regionGapJson as RegionGap[];
}

export function getRegion(code: string): RegionGapDetail | undefined {
  const base = getRegions().find((r) => r.code === code);
  if (!base) return undefined;
  const topCandidateIds = RESTAURANTS.filter((r) => r.sigunguCode === code).slice(0, 3).map((r) => r.id);
  return { ...base, topCandidateIds, processingStatus: 'menu-checked' };
}

export function getComparisonRegions(): [RegionGap, RegionGap, RegionGap] {
  const byCode = (c: string) => getRegions().find((r) => r.code === c)!;
  return [byCode('11170') /* Yongsan */, byCode('26350') /* Busan Haeundae-ish */, byCode('51150') /* gap region */];
}
```

> If the exact 시군구 codes differ after Task 11 generation, update the three codes in `getComparisonRegions` and note them in `README.md`.

- [ ] **Step 3: `lib/mockData.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { RESTAURANTS, getRestaurant, getRegions, getComparisonRegions } from './mockData';

describe('mockData', () => {
  it('has at least 24 restaurants', () => expect(RESTAURANTS.length).toBeGreaterThanOrEqual(24));
  it('every restaurant has en + ko names', () => {
    for (const r of RESTAURANTS) { expect(r.name.en).toBeTruthy(); expect(r.name.ko).toBeTruthy(); }
  });
  it('every restaurant id is unique', () => {
    expect(new Set(RESTAURANTS.map((r) => r.id)).size).toBe(RESTAURANTS.length);
  });
  it('getRestaurant returns by id', () => {
    expect(getRestaurant(RESTAURANTS[0].id)?.id).toBe(RESTAURANTS[0].id);
  });
  it('getComparisonRegions returns three distinct regions', () => {
    const [a, b, c] = getComparisonRegions();
    expect(new Set([a.code, b.code, c.code]).size).toBe(3);
  });
});
```

- [ ] **Step 4: Run** `npm test -- mockData` — Expected: all pass (after Task 11 provides `region-gap.json`; run this task's tests again then).

- [ ] **Step 5: Commit**

```bash
cd /Users/takyerin/claude && git add plately/plately-web && git commit -m "feat(plately): shared types + restaurant mock data"
```

---

### Task 11: Region gap data (229 rows)

**Files:**
- Create: `scripts/gen-region-gap.mjs`
- Create: `public/data/region-gap.json`

- [ ] **Step 1: Write `scripts/gen-region-gap.mjs`** — deterministic pseudo-random generator keyed off 시군구 code so numbers are stable across runs:

```js
import { readFileSync, writeFileSync } from 'node:fs';

// Expects public/sigungu.simplified.geojson to exist (Task 21). If not yet, use the
// fallback embedded list below.
let features;
try {
  const geo = JSON.parse(readFileSync('public/sigungu.simplified.geojson', 'utf8'));
  features = geo.features.map((f) => ({
    code: String(f.properties.SIG_CD ?? f.properties.code),
    ko: f.properties.SIG_KOR_NM ?? f.properties.name,
  }));
} catch {
  features = JSON.parse(readFileSync('scripts/sigungu-list.fallback.json', 'utf8'));
}

function hash(s) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0) / 2 ** 32; }

const GWANGYEOK = { 11: 'Seoul', 26: 'Busan', 27: 'Daegu', 28: 'Incheon', 29: 'Gwangju', 30: 'Daejeon', 31: 'Ulsan', 36: 'Sejong', 41: 'Gyeonggi', 43: 'Chungbuk', 44: 'Chungnam', 46: 'Jeonnam', 47: 'Gyeongbuk', 48: 'Gyeongnam', 50: 'Jeju', 51: 'Gangwon', 52: 'Jeonbuk' };

const rows = features.map(({ code, ko }) => {
  const seoulish = code.startsWith('11') || code.startsWith('26') || code.startsWith('50');
  const demandScore = Math.round((seoulish ? 55 : 15) + hash(code + 'd') * 45);
  const supplyCount = Math.round((seoulish ? 6 : 0) + hash(code + 's') * (seoulish ? 20 : 4));
  const norm = supplyCount / Math.max(1, demandScore / 10);
  const gapIndex = Math.max(0, Math.min(100, Math.round(demandScore - norm * 30)));
  const trendVs2019 = Math.round((hash(code + 't') - 0.55) * 40);
  return {
    code, gwangyeok: GWANGYEOK[Number(code.slice(0, 2))] ?? 'Other',
    name: { en: ko, ko, ar: ko, hi: ko },
    demandScore, supplyCount, gapIndex, trendVs2019,
  };
});

writeFileSync('public/data/region-gap.json', JSON.stringify(rows, null, 2));
console.log(`wrote ${rows.length} regions`);
```

- [ ] **Step 2: Create `scripts/sigungu-list.fallback.json`** — a JSON array of `{code, ko}` for all 229 시군구 (2023 행정표준코드). If Task 21 runs first this file is unused; include it so this task is not blocked. (Populate from the public 행정표준관리시스템 list.)

- [ ] **Step 3: Run** `node scripts/gen-region-gap.mjs`
Expected: `wrote 229 regions` (± a few; 226–250 acceptable depending on GeoJSON vintage).

- [ ] **Step 4: Assert count in a test** — append to `lib/mockData.test.ts`:

```ts
it('has ~229 regions', () => {
  const n = getRegions().length;
  expect(n).toBeGreaterThanOrEqual(220);
  expect(n).toBeLessThanOrEqual(260);
});
it('gap index is within 0..100', () => {
  for (const r of getRegions()) { expect(r.gapIndex).toBeGreaterThanOrEqual(0); expect(r.gapIndex).toBeLessThanOrEqual(100); }
});
```

- [ ] **Step 5: Run** `npm test -- mockData` — Expected: all pass.

- [ ] **Step 6: Commit**

```bash
cd /Users/takyerin/claude && git add plately/plately-web && git commit -m "feat(plately): generate 229-시군구 gap dataset"
```

---

### Task 12: `lib/filter.ts` — restaurant filter logic

**Files:**
- Create: `lib/filter.ts`, `lib/filter.test.ts`

- [ ] **Step 1: Write `lib/filter.test.ts` first**

```ts
import { describe, it, expect } from 'vitest';
import { applyRestaurantFilter, filterFromPreferences } from './filter';
import type { Restaurant } from './types';

const base = (over: Partial<Restaurant>): Restaurant => ({
  id: 'x', name: { en: 'x', ko: 'x' }, area: { en: 'a', ko: 'a' }, sigunguCode: '11110',
  coords: [127, 37], cuisine: 'korean', confidence: 'name', matchedTokens: [], repMenu: [],
  attributes: { containsPork: false, servesAlcohol: false, containsBeef: false, vegetarianFriendly: false },
  ...over,
});

const pork = base({ id: 'pork', attributes: { containsPork: true, servesAlcohol: false, containsBeef: false, vegetarianFriendly: false } });
const beef = base({ id: 'beef', attributes: { containsPork: false, servesAlcohol: false, containsBeef: true, vegetarianFriendly: false } });
const booze = base({ id: 'booze', attributes: { containsPork: false, servesAlcohol: true, containsBeef: false, vegetarianFriendly: false } });
const boozeUnknown = base({ id: 'booze?', attributes: { containsPork: false, servesAlcohol: 'unknown', containsBeef: false, vegetarianFriendly: false } });
const veg = base({ id: 'veg', attributes: { containsPork: false, servesAlcohol: false, containsBeef: false, vegetarianFriendly: true } });
const list = [pork, beef, booze, boozeUnknown, veg];

describe('applyRestaurantFilter', () => {
  it('no filter returns everything', () => {
    expect(applyRestaurantFilter(list, {}).map((r) => r.id)).toEqual(list.map((r) => r.id));
  });
  it('avoidPork drops pork venues', () => {
    expect(applyRestaurantFilter(list, { avoidPork: true }).some((r) => r.id === 'pork')).toBe(false);
  });
  it('avoidBeef drops beef venues', () => {
    expect(applyRestaurantFilter(list, { avoidBeef: true }).some((r) => r.id === 'beef')).toBe(false);
  });
  it('avoidAlcohol drops confirmed alcohol but KEEPS unknown', () => {
    const out = applyRestaurantFilter(list, { avoidAlcohol: true }).map((r) => r.id);
    expect(out).not.toContain('booze');
    expect(out).toContain('booze?');
  });
  it('vegetarianOnly keeps only vegetarian-friendly', () => {
    expect(applyRestaurantFilter(list, { vegetarianOnly: true }).map((r) => r.id)).toEqual(['veg']);
  });
  it('cuisines filter is an OR match', () => {
    const out = applyRestaurantFilter([base({ id: 'a', cuisine: 'seafood' }), base({ id: 'b', cuisine: 'korean' })], { cuisines: ['seafood'] });
    expect(out.map((r) => r.id)).toEqual(['a']);
  });
});

describe('filterFromPreferences', () => {
  it('muslim profile avoids pork, alcohol optional', () => {
    expect(filterFromPreferences({ profile: 'muslim', avoidPork: true, avoidAlcohol: false, avoidBeef: false, vegetarianOnly: false }))
      .toMatchObject({ avoidPork: true, avoidAlcohol: false });
  });
  it('hindu profile avoids beef', () => {
    expect(filterFromPreferences({ profile: 'hindu', avoidPork: false, avoidAlcohol: false, avoidBeef: true, vegetarianOnly: true }))
      .toMatchObject({ avoidBeef: true, vegetarianOnly: true });
  });
});
```

- [ ] **Step 2: Run** `npm test -- filter` — Expected: FAIL (module not found).

- [ ] **Step 3: Write `lib/filter.ts`**

```ts
import type { Restaurant, RestaurantFilter, Preferences } from './types';

export function applyRestaurantFilter(list: Restaurant[], f: RestaurantFilter): Restaurant[] {
  return list.filter((r) => {
    const a = r.attributes;
    if (f.avoidPork && a.containsPork) return false;
    if (f.avoidBeef && a.containsBeef) return false;
    if (f.avoidAlcohol && a.servesAlcohol === true) return false; // 'unknown' is kept, surfaced in UI
    if (f.vegetarianOnly && !a.vegetarianFriendly) return false;
    if (f.cuisines && f.cuisines.length > 0 && !f.cuisines.includes(r.cuisine)) return false;
    if (f.sigunguCode && r.sigunguCode !== f.sigunguCode) return false;
    return true;
  });
}

export function filterFromPreferences(p: Preferences): RestaurantFilter {
  return {
    avoidPork: p.avoidPork,
    avoidAlcohol: p.avoidAlcohol,
    avoidBeef: p.avoidBeef,
    vegetarianOnly: p.vegetarianOnly,
    sigunguCode: undefined,
  };
}
```

- [ ] **Step 4: Run** `npm test -- filter` — Expected: all pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/takyerin/claude && git add plately/plately-web && git commit -m "feat(plately): restaurant filter logic (the real-data seam)"
```

---

### Task 13: `lib/gapScale.ts` + `lib/format.ts`

**Files:**
- Create: `lib/gapScale.ts`, `lib/gapScale.test.ts`, `lib/format.ts`, `lib/format.test.ts`

- [ ] **Step 1: `lib/gapScale.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { gapColor, gapBucket, GAP_STOPS } from './gapScale';

describe('gapScale', () => {
  it('low gap → green stop', () => expect(gapColor(0)).toBe(GAP_STOPS[0].color));
  it('high gap → clay stop', () => expect(gapColor(100)).toBe(GAP_STOPS[GAP_STOPS.length - 1].color));
  it('clamps out-of-range input', () => {
    expect(gapColor(-20)).toBe(gapColor(0));
    expect(gapColor(999)).toBe(gapColor(100));
  });
  it('bucket labels are stable', () => {
    expect(gapBucket(10)).toBe('low');
    expect(gapBucket(50)).toBe('medium');
    expect(gapBucket(85)).toBe('high');
  });
});
```

- [ ] **Step 2: `lib/gapScale.ts`**

```ts
export const GAP_STOPS = [
  { at: 0, color: '#1F6E52' },
  { at: 50, color: '#E0A458' },
  { at: 100, color: '#B4472E' },
] as const;

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));

export function gapColor(value: number): string {
  const v = clamp(value);
  for (let i = 1; i < GAP_STOPS.length; i++) {
    const a = GAP_STOPS[i - 1];
    const b = GAP_STOPS[i];
    if (v <= b.at) {
      const t = (v - a.at) / (b.at - a.at || 1);
      return lerpHex(a.color, b.color, t);
    }
  }
  return GAP_STOPS[GAP_STOPS.length - 1].color;
}

export function gapBucket(value: number): 'low' | 'medium' | 'high' {
  const v = clamp(value);
  return v < 33 ? 'low' : v < 67 ? 'medium' : 'high';
}

/** MapLibre `interpolate` expression stops, for the fill layer. */
export function gapInterpolateStops(): (number | string)[] {
  return GAP_STOPS.flatMap((s) => [s.at, s.color]);
}

function lerpHex(a: string, b: string, t: number): string {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  const mix = pa.map((c, i) => Math.round(c + (pb[i] - c) * t));
  return '#' + mix.map((c) => c.toString(16).padStart(2, '0')).join('');
}
```

- [ ] **Step 3: `lib/format.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { formatCount, formatGapIndex, formatPercent } from './format';

describe('format', () => {
  it('gap index is always Latin digits regardless of locale', () => {
    expect(formatGapIndex(42, 'ar')).toBe('42');
    expect(formatGapIndex(42, 'hi')).toBe('42');
  });
  it('counts are localized', () => {
    expect(formatCount(1234, 'en')).toBe('1,234');
  });
  it('percent keeps sign', () => {
    expect(formatPercent(-12, 'en')).toBe('-12%');
    expect(formatPercent(8, 'en')).toBe('+8%');
  });
});
```

- [ ] **Step 4: `lib/format.ts`**

```ts
import type { Locale } from './types';

export function formatGapIndex(value: number, _locale: Locale): string {
  return new Intl.NumberFormat('en', { maximumFractionDigits: 0 }).format(Math.round(value));
}
export function formatCount(value: number, locale: Locale): string {
  return new Intl.NumberFormat(locale).format(value);
}
export function formatPercent(value: number, locale: Locale): string {
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  return `${sign}${new Intl.NumberFormat(locale).format(Math.abs(value))}%`;
}
export function formatDate(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(iso));
}
```

- [ ] **Step 5: Run** `npm test -- "gapScale|format"` — Expected: all pass.

- [ ] **Step 6: Commit**

```bash
cd /Users/takyerin/claude && git add plately/plately-web && git commit -m "feat(plately): gap color scale + locale-aware formatters"
```

---

### Task 14: `usePreferences` hook

**Files:**
- Create: `lib/usePreferences.ts`, `lib/usePreferences.test.tsx`

- [ ] **Step 1: `lib/usePreferences.test.tsx`**

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePreferences, DEFAULT_PREFERENCES } from './usePreferences';

beforeEach(() => localStorage.clear());

describe('usePreferences', () => {
  it('starts from defaults when storage is empty', () => {
    const { result } = renderHook(() => usePreferences());
    expect(result.current.prefs).toEqual(DEFAULT_PREFERENCES);
  });
  it('persists updates to localStorage', () => {
    const { result } = renderHook(() => usePreferences());
    act(() => result.current.setProfile('muslim'));
    expect(JSON.parse(localStorage.getItem('plately.prefs')!).profile).toBe('muslim');
    expect(JSON.parse(localStorage.getItem('plately.prefs')!).avoidPork).toBe(true);
  });
  it('hindu profile sets avoidBeef', () => {
    const { result } = renderHook(() => usePreferences());
    act(() => result.current.setProfile('hindu'));
    expect(result.current.prefs.avoidBeef).toBe(true);
  });
  it('rehydrates from existing storage', () => {
    localStorage.setItem('plately.prefs', JSON.stringify({ ...DEFAULT_PREFERENCES, city: 'busan' }));
    const { result } = renderHook(() => usePreferences());
    expect(result.current.prefs.city).toBe('busan');
  });
});
```

- [ ] **Step 2: `lib/usePreferences.ts`**

```ts
'use client';
import { useCallback, useEffect, useState } from 'react';
import type { Preferences } from './types';

const KEY = 'plately.prefs';

export const DEFAULT_PREFERENCES: Preferences = {
  profile: 'porkfree',
  avoidPork: true,
  avoidAlcohol: false,
  avoidBeef: false,
  vegetarianOnly: false,
};

const PROFILE_DEFAULTS: Record<Preferences['profile'], Partial<Preferences>> = {
  muslim: { avoidPork: true, avoidBeef: false },
  hindu: { avoidBeef: true, avoidPork: false },
  porkfree: { avoidPork: true, avoidBeef: false, avoidAlcohol: false, vegetarianOnly: false },
  custom: {},
};

function read(): Preferences {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    return { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function usePreferences() {
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => { setPrefs(read()); setHydrated(true); }, []);

  const persist = useCallback((next: Preferences) => {
    setPrefs(next);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* private mode */ }
  }, []);

  const update = useCallback((patch: Partial<Preferences>) => {
    persist({ ...read(), ...patch });
  }, [persist]);

  const setProfile = useCallback((profile: Preferences['profile']) => {
    persist({ ...read(), profile, ...PROFILE_DEFAULTS[profile] });
  }, [persist]);

  return { prefs, hydrated, update, setProfile };
}
```

- [ ] **Step 3: Run** `npm test -- usePreferences` — Expected: 4 passed.

- [ ] **Step 4: Commit**

```bash
cd /Users/takyerin/claude && git add plately/plately-web && git commit -m "feat(plately): usePreferences localStorage hook"
```

---

## Phase 3 — Explore mode

### Task 15: Onboarding step 1 (profile + toggles)

**Files:**
- Create: `components/explore/OnboardingCard.tsx` (+ css)
- Create: `app/[locale]/start/OnboardingFlow.tsx` (client)
- Modify: `app/[locale]/start/page.tsx`
- Create: `components/explore/OnboardingCard.test.tsx`

- [ ] **Step 1: `components/explore/OnboardingCard.tsx`**

```tsx
'use client';
import styles from './OnboardingCard.module.css';

export function OnboardingCard({
  title, description, selected, onSelect,
}: { title: string; description?: string; selected: boolean; onSelect: () => void }) {
  return (
    <button type="button" className={styles.card} data-selected={selected} aria-pressed={selected} onClick={onSelect}>
      <span className={styles.title}>{title}</span>
      {description && <span className={styles.desc}>{description}</span>}
    </button>
  );
}
```

`OnboardingCard.module.css`:

```css
.card { display: flex; flex-direction: column; gap: var(--space-1); align-items: start; text-align: start; padding: var(--space-4); border: 1.5px solid var(--line); border-radius: var(--radius-md); background: var(--paper-raised); cursor: pointer; min-block-size: 84px; }
.card[data-selected="true"] { border-color: var(--primary); box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 20%, transparent); }
.title { font-weight: 700; }
.desc { font-size: 13px; color: var(--ink-soft); }
```

- [ ] **Step 2: `app/[locale]/start/OnboardingFlow.tsx`**

```tsx
'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { usePreferences } from '@/lib/usePreferences';
import { OnboardingCard } from '@/components/explore/OnboardingCard';
import { Toggle } from '@/components/ui/Toggle';
import styles from './onboarding.module.css';

const CITIES = ['seoul', 'busan', 'incheon', 'jeju'];

export function OnboardingFlow() {
  const t = useTranslations('onboarding');
  const router = useRouter();
  const { prefs, update, setProfile } = usePreferences();
  const [step, setStep] = useState<1 | 2>(1);

  return (
    <div className={styles.wrap}>
      {step === 1 && (
        <section aria-labelledby="ob-step1">
          <h1 id="ob-step1" className={styles.h}>{t('step1Title')}</h1>
          <div className={styles.grid}>
            <OnboardingCard title={t('muslim')} description={t('muslimDesc')} selected={prefs.profile === 'muslim'} onSelect={() => setProfile('muslim')} />
            <OnboardingCard title={t('hindu')} description={t('hinduDesc')} selected={prefs.profile === 'hindu'} onSelect={() => setProfile('hindu')} />
            <OnboardingCard title={t('porkfree')} selected={prefs.profile === 'porkfree'} onSelect={() => setProfile('porkfree')} />
            <OnboardingCard title={t('custom')} selected={prefs.profile === 'custom'} onSelect={() => setProfile('custom')} />
          </div>
          <div className={styles.toggles}>
            {prefs.profile === 'muslim' && (
              <Toggle checked={prefs.avoidAlcohol} onChange={(v) => update({ avoidAlcohol: v })} label={t('alcoholToggle')} />
            )}
            {prefs.profile === 'hindu' && (
              <Toggle checked={prefs.vegetarianOnly} onChange={(v) => update({ vegetarianOnly: v })} label={t('vegToggle')} />
            )}
            {prefs.profile === 'custom' && (
              <>
                <Toggle checked={prefs.avoidPork} onChange={(v) => update({ avoidPork: v })} label={t('muslimDesc')} />
                <Toggle checked={prefs.avoidBeef} onChange={(v) => update({ avoidBeef: v })} label={t('hinduDesc')} />
                <Toggle checked={prefs.avoidAlcohol} onChange={(v) => update({ avoidAlcohol: v })} label={t('alcoholToggle')} />
                <Toggle checked={prefs.vegetarianOnly} onChange={(v) => update({ vegetarianOnly: v })} label={t('vegToggle')} />
              </>
            )}
          </div>
          <div className={styles.actions}>
            <button className={styles.ghost} onClick={() => router.push('/explore')}>{t('skip')}</button>
            <button className={styles.primary} onClick={() => setStep(2)}>{t('next')}</button>
          </div>
        </section>
      )}
      {step === 2 && (
        <section aria-labelledby="ob-step2">
          <h1 id="ob-step2" className={styles.h}>{t('step2Title')}</h1>
          <div className={styles.grid}>
            {CITIES.map((c) => (
              <OnboardingCard key={c} title={c} selected={prefs.city === c} onSelect={() => update({ city: c })} />
            ))}
            <OnboardingCard title={t('nearMe')} selected={prefs.city === 'near'} onSelect={() => update({ city: 'near' })} />
          </div>
          <div className={styles.actions}>
            <button className={styles.ghost} onClick={() => setStep(1)}>{t('back' as never)}</button>
            <button className={styles.primary} onClick={() => router.push('/explore')}>{t('done')}</button>
          </div>
        </section>
      )}
    </div>
  );
}
```

`app/[locale]/start/onboarding.module.css`:

```css
.wrap { max-inline-size: 640px; margin-inline: auto; padding: var(--space-8) var(--space-6) var(--space-12); }
.h { font-size: 22px; margin-block: 0 var(--space-6); }
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); }
.toggles { display: flex; flex-direction: column; gap: var(--space-2); margin-block-start: var(--space-4); }
.actions { display: flex; justify-content: space-between; margin-block-start: var(--space-8); }
.primary { background: var(--primary); color: var(--primary-contrast); border: 0; border-radius: 999px; padding: 10px 22px; font-weight: 700; cursor: pointer; }
.ghost { background: none; border: 1px solid var(--line); border-radius: 999px; padding: 10px 22px; cursor: pointer; color: var(--ink); }
```

- [ ] **Step 3: `app/[locale]/start/page.tsx`**

```tsx
import { setRequestLocale } from 'next-intl/server';
import { OnboardingFlow } from './OnboardingFlow';

export default async function StartPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <OnboardingFlow />;
}
```

- [ ] **Step 4: `components/explore/OnboardingCard.test.tsx`**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OnboardingCard } from './OnboardingCard';

describe('OnboardingCard', () => {
  it('reflects selected state and fires onSelect', async () => {
    const onSelect = vi.fn();
    render(<OnboardingCard title="Muslim" selected={false} onSelect={onSelect} />);
    const btn = screen.getByRole('button', { name: /muslim/i });
    expect(btn).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(btn);
    expect(onSelect).toHaveBeenCalledOnce();
  });
});
```

Run `npm install -D @testing-library/user-event@^14` if not present.

- [ ] **Step 5: Run** `npm test -- OnboardingCard` — Expected: 1 passed.

- [ ] **Step 6: Verify** — `npm run dev`, `/en/start`: pick Muslim → alcohol toggle appears; Next → city step; Done → `/en/explore`. Reload `/en/start` → Muslim still selected. Check `/ar/start` is RTL. Stop server.

- [ ] **Step 7: Commit**

```bash
cd /Users/takyerin/claude && git add plately/plately-web && git commit -m "feat(plately): onboarding flow (profile, toggles, city)"
```

---

### Task 16: Onboarding persistence e2e-lite check

**Files:**
- Modify: `tests/e2e/smoke.spec.ts` (created in Task 27 — if running earlier, create it now with just this test)

- [ ] **Step 1: Add test**

```ts
import { test, expect } from '@playwright/test';

test('onboarding choice persists across reload', async ({ page }) => {
  await page.goto('/en/start');
  await page.getByRole('button', { name: 'Muslim' }).click();
  await expect(page.getByRole('switch', { name: /alcohol/i })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Muslim' })).toHaveAttribute('aria-pressed', 'true');
});
```

- [ ] **Step 2: Run** `npm run e2e -- smoke` — Expected: pass.

- [ ] **Step 3: Commit**

```bash
cd /Users/takyerin/claude && git add plately/plately-web && git commit -m "test(plately): onboarding persistence e2e"
```

---

### Task 17: `BaseMap` — MapLibre wrapper

**Files:**
- Create: `components/map/BaseMap.tsx` (+ css)
- Create: `components/map/mapStyle.ts`

- [ ] **Step 1: `components/map/mapStyle.ts`**

```ts
// Keyless OpenFreeMap vector style. Swap `positron` for a custom style JSON later.
export const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';
export const KOREA_CENTER: [number, number] = [127.7669, 35.9078];
export const KOREA_BOUNDS: [[number, number], [number, number]] = [
  [124.5, 33.0],
  [131.9, 38.7],
];
```

- [ ] **Step 2: `components/map/BaseMap.tsx`**

```tsx
'use client';
import { useEffect, useRef } from 'react';
import maplibregl, { Map as MlMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MAP_STYLE_URL, KOREA_CENTER } from './mapStyle';
import styles from './BaseMap.module.css';

export function BaseMap({
  center = KOREA_CENTER, zoom = 6, onReady, className,
}: {
  center?: [number, number]; zoom?: number;
  onReady?: (map: MlMap) => void; className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: ref.current,
      style: MAP_STYLE_URL,
      center,
      zoom,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.on('load', () => onReady?.(map));
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={ref} className={`${styles.map} ${className ?? ''}`} role="application" aria-label="Map" />;
}
```

`BaseMap.module.css`:

```css
.map { inline-size: 100%; block-size: 100%; min-block-size: 320px; border-radius: var(--radius-md); overflow: hidden; }
:global(.maplibregl-ctrl-top-right) { inset-inline-end: 8px; inset-inline-start: auto; }
```

- [ ] **Step 3: Verify** — temporarily drop `<BaseMap />` into `app/[locale]/explore/page.tsx` in a 400px box, `npm run dev`, confirm tiles load at `/en/explore` with no console errors. Revert the temp edit. Stop server.

- [ ] **Step 4: Commit**

```bash
cd /Users/takyerin/claude && git add plately/plately-web && git commit -m "feat(plately): MapLibre BaseMap wrapper + keyless style"
```

---

### Task 18: Explore page — filter chips + list

**Files:**
- Create: `components/explore/FilterChips.tsx` (+ css), `components/explore/RestaurantCard.tsx` (+ css), `components/explore/RestaurantList.tsx` (+ css)
- Create: `app/[locale]/explore/ExploreView.tsx` (client)
- Modify: `app/[locale]/explore/page.tsx`
- Create: `components/explore/RestaurantCard.test.tsx`

- [ ] **Step 1: `components/explore/FilterChips.tsx`**

```tsx
'use client';
import { useTranslations } from 'next-intl';
import styles from './FilterChips.module.css';

export type ChipKey = 'porkFree' | 'alcoholFree' | 'vegetarian' | 'beefFree' | 'seafood' | 'chicken' | 'korean' | 'halalCertified';

export function FilterChips({ active, onToggle }: { active: Set<ChipKey>; onToggle: (k: ChipKey) => void }) {
  const t = useTranslations('filters');
  const keys: ChipKey[] = ['porkFree', 'alcoholFree', 'vegetarian', 'beefFree', 'seafood', 'chicken', 'korean', 'halalCertified'];
  return (
    <div className={styles.row} role="group" aria-label="Filters">
      {keys.map((k) => (
        <button key={k} type="button" className={styles.chip} data-on={active.has(k)} aria-pressed={active.has(k)} onClick={() => onToggle(k)}>
          {t(k)}
        </button>
      ))}
    </div>
  );
}
```

`FilterChips.module.css`:

```css
.row { display: flex; flex-wrap: wrap; gap: var(--space-2); padding: var(--space-3) 0; }
.chip { border: 1px solid var(--line); background: var(--paper-raised); color: var(--ink-soft); border-radius: 999px; padding: 6px 12px; font-size: 13px; cursor: pointer; }
.chip[data-on="true"] { border-color: var(--primary); color: var(--primary); background: color-mix(in srgb, var(--primary) 8%, transparent); font-weight: 700; }
```

- [ ] **Step 2: `components/explore/RestaurantCard.tsx`**

```tsx
'use client';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Badge } from '@/components/ui/Badge';
import type { Restaurant, Locale } from '@/lib/types';
import styles from './RestaurantCard.module.css';

export function RestaurantCard({ r }: { r: Restaurant }) {
  const locale = useLocale() as Locale;
  const t = useTranslations('confidence');
  const name = r.name[locale] ?? r.name.en;
  const area = r.area[locale] ?? r.area.en;
  return (
    <Link href={`/explore/${r.id}`} className={styles.card}>
      <div className={styles.head}>
        <span className={styles.name}>{name}</span>
        <Badge tone={r.confidence}>{t(r.confidence)}</Badge>
      </div>
      <div className={styles.meta}>{area} · {r.cuisine}</div>
      <div className={styles.tags}>
        {!r.attributes.containsPork && <span className={styles.tag}>pork-free</span>}
        {r.attributes.servesAlcohol === false && <span className={styles.tag}>alcohol-free</span>}
        {r.attributes.vegetarianFriendly && <span className={styles.tag}>veg</span>}
      </div>
    </Link>
  );
}
```

`RestaurantCard.module.css`:

```css
.card { display: block; padding: var(--space-4); border: 1px solid var(--line); border-radius: var(--radius-md); background: var(--paper-raised); text-decoration: none; margin-block-end: var(--space-3); }
.head { display: flex; justify-content: space-between; align-items: start; gap: var(--space-2); }
.name { font-weight: 700; }
.meta { font-size: 13px; color: var(--ink-soft); margin-block-start: var(--space-1); }
.tags { display: flex; gap: var(--space-1); flex-wrap: wrap; margin-block-start: var(--space-2); }
.tag { font-size: 11px; border: 1px solid var(--line); border-radius: 999px; padding: 1px 8px; color: var(--ink-soft); }
```

- [ ] **Step 3: `components/explore/RestaurantList.tsx`**

```tsx
import type { Restaurant } from '@/lib/types';
import { RestaurantCard } from './RestaurantCard';
import styles from './RestaurantList.module.css';

export function RestaurantList({ items }: { items: Restaurant[] }) {
  return (
    <div className={styles.list}>
      {items.map((r) => <RestaurantCard key={r.id} r={r} />)}
      {items.length === 0 && <p className={styles.empty}>No matches — try removing a filter.</p>}
    </div>
  );
}
```

`RestaurantList.module.css`:

```css
.list { overflow-y: auto; padding-inline-end: var(--space-2); }
.empty { color: var(--ink-soft); padding: var(--space-6); text-align: center; }
```

- [ ] **Step 4: `app/[locale]/explore/ExploreView.tsx`** (list only for now; map added Task 19)

```tsx
'use client';
import { useMemo, useState, useEffect } from 'react';
import { FilterChips, type ChipKey } from '@/components/explore/FilterChips';
import { RestaurantList } from '@/components/explore/RestaurantList';
import { getRestaurants } from '@/lib/mockData';
import { usePreferences } from '@/lib/usePreferences';
import type { RestaurantFilter } from '@/lib/types';
import styles from './explore.module.css';

const CHIP_TO_FILTER: Partial<Record<ChipKey, Partial<RestaurantFilter>>> = {
  porkFree: { avoidPork: true },
  alcoholFree: { avoidAlcohol: true },
  vegetarian: { vegetarianOnly: true },
  beefFree: { avoidBeef: true },
};
const CHIP_CUISINE: Partial<Record<ChipKey, string>> = { seafood: 'seafood', chicken: 'korean-chicken', korean: 'korean' };

export function ExploreView() {
  const { prefs, hydrated } = usePreferences();
  const [chips, setChips] = useState<Set<ChipKey>>(new Set());

  useEffect(() => {
    if (!hydrated) return;
    const next = new Set<ChipKey>();
    if (prefs.avoidPork) next.add('porkFree');
    if (prefs.avoidAlcohol) next.add('alcoholFree');
    if (prefs.avoidBeef) next.add('beefFree');
    if (prefs.vegetarianOnly) next.add('vegetarian');
    setChips(next);
  }, [hydrated, prefs]);

  const filter = useMemo<RestaurantFilter>(() => {
    const f: RestaurantFilter = {};
    const cuisines: string[] = [];
    for (const c of chips) {
      Object.assign(f, CHIP_TO_FILTER[c]);
      if (CHIP_CUISINE[c]) cuisines.push(CHIP_CUISINE[c]!);
    }
    if (cuisines.length) f.cuisines = cuisines;
    return f;
  }, [chips]);

  const results = useMemo(() => getRestaurants(filter), [filter]);

  function toggle(k: ChipKey) {
    setChips((prev) => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n; });
  }

  return (
    <div className={styles.view}>
      <div className={styles.panel}>
        <FilterChips active={chips} onToggle={toggle} />
        <p className={styles.count}>{results.length} places</p>
        <RestaurantList items={results} />
      </div>
      <div className={styles.mapSlot} aria-hidden />
    </div>
  );
}
```

`app/[locale]/explore/explore.module.css`:

```css
.view { display: grid; grid-template-columns: minmax(320px, 420px) 1fr; gap: var(--space-4); block-size: calc(100dvh - 64px); padding: var(--space-4) var(--space-6); }
.panel { display: flex; flex-direction: column; min-block-size: 0; }
.count { font-size: 13px; color: var(--ink-soft); margin: 0 0 var(--space-2); }
.mapSlot { background: var(--paper-raised); border: 1px solid var(--line); border-radius: var(--radius-md); }
@media (max-width: 900px) { .view { grid-template-columns: 1fr; } .mapSlot { display: none; } }
```

- [ ] **Step 5: `app/[locale]/explore/page.tsx`**

```tsx
import { setRequestLocale } from 'next-intl/server';
import { ExploreView } from './ExploreView';

export default async function ExplorePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ExploreView />;
}
```

- [ ] **Step 6: `components/explore/RestaurantCard.test.tsx`**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import messages from '@/messages/en.json';
import type { Restaurant } from '@/lib/types';

vi.mock('@/i18n/navigation', () => ({ Link: (p: any) => <a href={p.href}>{p.children}</a> }));
import { RestaurantCard } from './RestaurantCard';

const r: Restaurant = {
  id: 'r1', name: { en: 'Sea House', ko: '바다집' }, area: { en: 'Busan', ko: '부산' },
  sigunguCode: '26350', coords: [129, 35], cuisine: 'seafood',
  attributes: { containsPork: false, servesAlcohol: false, containsBeef: false, vegetarianFriendly: false },
  confidence: 'menu', matchedTokens: [], repMenu: [],
};

describe('RestaurantCard', () => {
  it('shows localized name and confidence badge', () => {
    render(<NextIntlClientProvider locale="en" messages={messages}><RestaurantCard r={r} /></NextIntlClientProvider>);
    expect(screen.getByText('Sea House')).toBeInTheDocument();
    expect(screen.getByText('Menu-checked')).toBeInTheDocument();
  });
});
```

- [ ] **Step 7: Run** `npm test -- RestaurantCard` — Expected: 1 passed.

- [ ] **Step 8: Verify** — `/en/explore` shows chips seeded from onboarding + a filtered list; toggling chips changes the count. Stop server.

- [ ] **Step 9: Commit**

```bash
cd /Users/takyerin/claude && git add plately/plately-web && git commit -m "feat(plately): explore list + filter chips wired to preferences"
```

---

### Task 19: Explore page — map pins + list/map sync

**Files:**
- Modify: `app/[locale]/explore/ExploreView.tsx`
- Create: `components/map/RestaurantPins.ts` (helper to add/update a GeoJSON source)

- [ ] **Step 1: `components/map/RestaurantPins.ts`**

```ts
import type { Map as MlMap } from 'maplibre-gl';
import type { Restaurant } from '@/lib/types';

const SRC = 'restaurants';

export function syncРins(map: MlMap, items: Restaurant[]): void {
  const data = {
    type: 'FeatureCollection' as const,
    features: items.map((r) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: r.coords },
      properties: { id: r.id, confidence: r.confidence },
    })),
  };
  const existing = map.getSource(SRC) as maplibregl.GeoJSONSource | undefined;
  if (existing) { existing.setData(data); return; }
  map.addSource(SRC, { type: 'geojson', data });
  map.addLayer({
    id: 'restaurant-dots',
    type: 'circle',
    source: SRC,
    paint: {
      'circle-radius': 6,
      'circle-stroke-width': 2,
      'circle-stroke-color': '#FBF8F3',
      'circle-color': [
        'match', ['get', 'confidence'],
        'phone', '#1F6E52', 'menu', '#C56B4A', /* name */ '#9A8F79',
      ],
    },
  });
}
```

> Rename the export to `syncPins` (ASCII) when implementing — the Cyrillic char above is a copy artifact. Use `syncPins`.

- [ ] **Step 2: Update `ExploreView.tsx`** — replace `.mapSlot` div with `<BaseMap onReady={...} />`, hold the map in a ref, call `syncPins(map, results)` in an effect keyed on `results` and on map-ready. Clicking a dot navigates to `/explore/{id}` via `useRouter`. Hovering a list card sets a `selectedId` that bumps that dot's radius via `setFeatureState`.

Concrete effect:

```tsx
// inside ExploreView
const mapRef = useRef<import('maplibre-gl').Map | null>(null);
const [ready, setReady] = useState(false);
const router = useRouter();

useEffect(() => {
  const map = mapRef.current;
  if (!map || !ready) return;
  syncPins(map, results);
}, [results, ready]);

// JSX:
<div className={styles.mapSlot}>
  <BaseMap onReady={(m) => { mapRef.current = m; setReady(true);
    m.on('click', 'restaurant-dots', (e) => {
      const id = e.features?.[0]?.properties?.id;
      if (id) router.push(`/explore/${id}`);
    });
    m.on('mouseenter', 'restaurant-dots', () => { m.getCanvas().style.cursor = 'pointer'; });
    m.on('mouseleave', 'restaurant-dots', () => { m.getCanvas().style.cursor = ''; });
  }} />
</div>
```

- [ ] **Step 3: Verify** — `/en/explore`: dots appear, colored by confidence; clicking a dot opens a (still-placeholder) detail route; filtering removes dots. Check `/ar/explore` keeps map controls on the inline-end side. Stop server.

- [ ] **Step 4: Commit**

```bash
cd /Users/takyerin/claude && git add plately/plately-web && git commit -m "feat(plately): restaurant pins + list/map interaction"
```

---

### Task 20: Restaurant detail page

**Files:**
- Modify: `app/[locale]/explore/[id]/page.tsx`
- Create: `components/explore/AttributeList.tsx` (+ css)
- Create: `components/explore/AttributeList.test.tsx`

- [ ] **Step 1: `components/explore/AttributeList.tsx`**

```tsx
import { useTranslations } from 'next-intl';
import type { RestaurantAttributes } from '@/lib/types';
import styles from './AttributeList.module.css';

function mark(v: boolean | 'unknown', t: (k: string) => string) {
  if (v === 'unknown') return t('unknown');
  return v ? t('yes') : t('no');
}

export function AttributeList({ a }: { a: RestaurantAttributes }) {
  const t = useTranslations('restaurant');
  const rows: [string, boolean | 'unknown', boolean][] = [
    [t('containsPork'), a.containsPork, a.containsPork === false],
    [t('servesAlcohol'), a.servesAlcohol, a.servesAlcohol === false],
    [t('containsBeef'), a.containsBeef, a.containsBeef === false],
    [t('vegetarianFriendly'), a.vegetarianFriendly, a.vegetarianFriendly === true],
  ];
  return (
    <ul className={styles.list}>
      {rows.map(([label, val, good]) => (
        <li key={label} className={styles.row} data-good={good}>
          <span>{label}</span><span className="tnum">{mark(val, t)}</span>
        </li>
      ))}
    </ul>
  );
}
```

`AttributeList.module.css`:

```css
.list { list-style: none; padding: 0; margin: 0; border: 1px solid var(--line); border-radius: var(--radius-md); overflow: hidden; }
.row { display: flex; justify-content: space-between; padding: var(--space-3) var(--space-4); border-block-end: 1px solid var(--line); }
.row:last-child { border-block-end: 0; }
.row[data-good="true"] { color: var(--primary); }
```

- [ ] **Step 2: `app/[locale]/explore/[id]/page.tsx`**

```tsx
import { notFound } from 'next/navigation';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { getRestaurant } from '@/lib/mockData';
import { AttributeList } from '@/components/explore/AttributeList';
import { Callout } from '@/components/ui/Callout';
import { Badge } from '@/components/ui/Badge';
import { formatDate } from '@/lib/format';
import type { Locale } from '@/lib/types';
import styles from './detail.module.css';

export default async function DetailPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const r = getRestaurant(id);
  if (!r) notFound();
  const t = await getTranslations('restaurant');
  const tc = await getTranslations('confidence');
  const l = locale as Locale;

  return (
    <article className={styles.wrap}>
      <header className={styles.hero}>
        <h1>{r.name[l] ?? r.name.en}</h1>
        <p>{r.area[l] ?? r.area.en} · {r.cuisine}</p>
        <Badge tone={r.confidence}>{tc(r.confidence)}</Badge>
      </header>

      <section>
        <h2>{t('whyListed')}</h2>
        <ul>
          {r.matchedTokens.length > 0 && <li>{t('matchedTokens')}: {r.matchedTokens.join(', ')}</li>}
          {r.confidence !== 'name' && <li>{t('menuChecked')}</li>}
          {r.phoneVerifiedOn && <li>{t('phoneVerified', { date: formatDate(r.phoneVerifiedOn, l) })}</li>}
        </ul>
      </section>

      <section>
        <h2>{t('attributes')}</h2>
        <AttributeList a={r.attributes} />
      </section>

      {r.repMenu.length > 0 && (
        <section>
          <h2>{t('repMenu')}</h2>
          <p>{r.repMenu.join(' · ')}</p>
        </section>
      )}

      <Callout>{t('disclaimer')}</Callout>
    </article>
  );
}
```

`app/[locale]/explore/[id]/detail.module.css`:

```css
.wrap { max-inline-size: 680px; margin-inline: auto; padding: var(--space-8) var(--space-6) var(--space-12); display: flex; flex-direction: column; gap: var(--space-6); }
.hero h1 { margin: 0; font-size: 24px; }
.hero p { color: var(--ink-soft); margin: var(--space-1) 0 var(--space-2); }
section h2 { font-size: 16px; margin-block: 0 var(--space-2); }
```

- [ ] **Step 3: `components/explore/AttributeList.test.tsx`**

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import messages from '@/messages/en.json';
import { AttributeList } from './AttributeList';

describe('AttributeList', () => {
  it('renders "Unknown" for tristate alcohol', () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <AttributeList a={{ containsPork: false, servesAlcohol: 'unknown', containsBeef: false, vegetarianFriendly: false }} />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText('Unknown')).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Run** `npm test -- AttributeList` — Expected: 1 passed.

- [ ] **Step 5: Verify** — click through from `/en/explore` to a detail page; try `/en/explore/does-not-exist` → 404. Stop server.

- [ ] **Step 6: Commit**

```bash
cd /Users/takyerin/claude && git add plately/plately-web && git commit -m "feat(plately): restaurant detail page"
```

---

## Phase 4 — Insight mode

### Task 21: 시군구 GeoJSON asset

**Files:**
- Create: `public/sigungu.simplified.geojson`
- Create: `scripts/build-geojson.sh`

- [ ] **Step 1: Write `scripts/build-geojson.sh`**

```bash
#!/usr/bin/env bash
set -euo pipefail
SRC="https://raw.githubusercontent.com/southkorea/southkorea-maps/master/kostat/2018/json/skorea-municipalities-2018-geo.json"
curl -sL "$SRC" -o /tmp/sigungu-raw.geojson
npx -y mapshaper /tmp/sigungu-raw.geojson \
  -simplify 8% keep-shapes \
  -rename-fields code=SIG_CD,name=SIG_KOR_NM \
  -o format=geojson precision=0.0001 public/sigungu.simplified.geojson
node -e "const g=require('./public/sigungu.simplified.geojson');console.log('features:',g.features.length);"
```

- [ ] **Step 2: Run** `bash scripts/build-geojson.sh`
Expected: `features: <N>` where N is between 226 and 260. File size < ~800 KB (`ls -lh public/sigungu.simplified.geojson`).

- [ ] **Step 3: If the source URL is unreachable**, use this fallback in the script: `SRC="https://raw.githubusercontent.com/raqoon886/Local_HangJeongDong/master/hangjeongdong_sigungu.geojson"` and adjust `-rename-fields` to that file's property names (`sigungu_cd`, `sigungu_nm`). Re-run Step 2.

- [ ] **Step 4: Regenerate region data** so codes match the GeoJSON:

Run: `node scripts/gen-region-gap.mjs`
Expected: `wrote <N> regions` matching the feature count.

- [ ] **Step 5: Run** `npm test -- mockData` — Expected: region count + range tests pass.

- [ ] **Step 6: Commit**

```bash
cd /Users/takyerin/claude && git add plately/plately-web && git commit -m "feat(plately): bundled simplified 시군구 GeoJSON + build script"
```

---

### Task 22: `ChoroplethMap` component

**Files:**
- Create: `components/map/ChoroplethMap.tsx` (+ css)
- Create: `components/map/joinGap.ts`, `components/map/joinGap.test.ts`

- [ ] **Step 1: `components/map/joinGap.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { joinGapIntoGeoJson } from './joinGap';

const geo = { type: 'FeatureCollection', features: [
  { type: 'Feature', properties: { code: '11110', name: 'Jongno-gu' }, geometry: { type: 'Point', coordinates: [0, 0] } },
] } as const;

describe('joinGapIntoGeoJson', () => {
  it('adds gapIndex/demand/supply from the gap rows', () => {
    const out = joinGapIntoGeoJson(geo as never, [
      { code: '11110', name: { en: 'x', ko: 'x' }, gwangyeok: 'Seoul', demandScore: 70, supplyCount: 5, gapIndex: 40, trendVs2019: 3 },
    ]);
    expect(out.features[0].properties.gapIndex).toBe(40);
    expect(out.features[0].properties.demandScore).toBe(70);
  });
  it('defaults gapIndex to 0 when no row matches', () => {
    const out = joinGapIntoGeoJson(geo as never, []);
    expect(out.features[0].properties.gapIndex).toBe(0);
  });
});
```

- [ ] **Step 2: `components/map/joinGap.ts`**

```ts
import type { RegionGap } from '@/lib/types';

type GeoJson = { type: 'FeatureCollection'; features: Array<{ type: 'Feature'; properties: Record<string, unknown>; geometry: unknown }> };

export function joinGapIntoGeoJson(geo: GeoJson, rows: RegionGap[]): GeoJson {
  const byCode = new Map(rows.map((r) => [r.code, r]));
  return {
    ...geo,
    features: geo.features.map((f) => {
      const row = byCode.get(String(f.properties.code));
      return {
        ...f,
        properties: {
          ...f.properties,
          gapIndex: row?.gapIndex ?? 0,
          demandScore: row?.demandScore ?? 0,
          supplyCount: row?.supplyCount ?? 0,
        },
      };
    }),
  };
}
```

- [ ] **Step 3: Run** `npm test -- joinGap` — Expected: 2 passed.

- [ ] **Step 4: `components/map/ChoroplethMap.tsx`**

```tsx
'use client';
import { useEffect, useRef, useState } from 'react';
import { BaseMap } from './BaseMap';
import { joinGapIntoGeoJson } from './joinGap';
import { gapInterpolateStops } from '@/lib/gapScale';
import { getRegions } from '@/lib/mockData';
import type { Map as MlMap } from 'maplibre-gl';

type Layer = 'gap' | 'demand' | 'supply';

export function ChoroplethMap({ layer = 'gap', onPick }: { layer?: Layer; onPick?: (code: string) => void }) {
  const mapRef = useRef<MlMap | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    (async () => {
      const geo = await fetch('/sigungu.simplified.geojson').then((r) => r.json());
      const joined = joinGapIntoGeoJson(geo, getRegions());
      if (map.getSource('sigungu')) (map.getSource('sigungu') as maplibregl.GeoJSONSource).setData(joined);
      else {
        map.addSource('sigungu', { type: 'geojson', data: joined });
        map.addLayer({
          id: 'sigungu-fill', type: 'fill', source: 'sigungu',
          paint: {
            'fill-color': ['interpolate', ['linear'], ['get', 'gapIndex'], ...gapInterpolateStops()],
            'fill-opacity': 0.78,
          },
        });
        map.addLayer({
          id: 'sigungu-line', type: 'line', source: 'sigungu',
          paint: { 'line-color': '#FBF8F3', 'line-width': 0.5 },
        });
        map.on('click', 'sigungu-fill', (e) => {
          const code = e.features?.[0]?.properties?.code;
          if (code) onPick?.(String(code));
        });
        map.on('mouseenter', 'sigungu-fill', () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', 'sigungu-fill', () => { map.getCanvas().style.cursor = ''; });
      }
      const prop = layer === 'demand' ? 'demandScore' : layer === 'supply' ? 'supplyCount' : 'gapIndex';
      map.setPaintProperty('sigungu-fill', 'fill-color',
        ['interpolate', ['linear'], ['get', prop], ...gapInterpolateStops()]);
    })();
  }, [ready, layer, onPick]);

  return <BaseMap zoom={6} onReady={(m) => { mapRef.current = m; setReady(true); }} />;
}
```

- [ ] **Step 5: Verify** — temp-mount `<ChoroplethMap />` on `/en/insight`, `npm run dev`, confirm the 시군구 fill renders with a green→clay spread and clicking logs a code. Stop server.

- [ ] **Step 6: Commit**

```bash
cd /Users/takyerin/claude && git add plately/plately-web && git commit -m "feat(plately): choropleth map with gap/demand/supply layers"
```

---

### Task 23: Insight gap map page + region panel + accessible list

**Files:**
- Create: `components/insight/RegionPanel.tsx` (+ css), `components/insight/RegionList.tsx` (+ css)
- Create: `app/[locale]/insight/InsightView.tsx` (client)
- Modify: `app/[locale]/insight/page.tsx`
- Create: `components/insight/RegionList.test.tsx`

- [ ] **Step 1: `components/insight/RegionList.tsx`** — the accessible equivalent of the map

```tsx
'use client';
import { useLocale, useTranslations } from 'next-intl';
import { gapBucket } from '@/lib/gapScale';
import { formatGapIndex } from '@/lib/format';
import type { RegionGap, Locale } from '@/lib/types';
import styles from './RegionList.module.css';

export function RegionList({ regions, onPick, selected }: {
  regions: RegionGap[]; onPick: (code: string) => void; selected?: string;
}) {
  const t = useTranslations('insight');
  const locale = useLocale() as Locale;
  const sorted = [...regions].sort((a, b) => b.gapIndex - a.gapIndex);
  return (
    <ul className={styles.list} aria-label={t('regionListLabel')}>
      {sorted.map((r) => (
        <li key={r.code}>
          <button type="button" className={styles.row} data-selected={r.code === selected} onClick={() => onPick(r.code)}>
            <span>{r.name[locale] ?? r.name.en}</span>
            <span className={`${styles.badge} tnum`} data-bucket={gapBucket(r.gapIndex)}>{formatGapIndex(r.gapIndex, locale)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
```

`RegionList.module.css`:

```css
.list { list-style: none; margin: 0; padding: 0; overflow-y: auto; max-block-size: 100%; }
.row { inline-size: 100%; display: flex; justify-content: space-between; align-items: center; gap: var(--space-2); padding: var(--space-2) var(--space-3); background: none; border: 0; border-block-end: 1px solid var(--line); cursor: pointer; color: var(--ink); }
.row[data-selected="true"] { background: color-mix(in srgb, var(--primary) 10%, transparent); }
.badge { padding: 1px 8px; border-radius: 999px; font-size: 12px; font-weight: 700; }
.badge[data-bucket="low"] { background: color-mix(in srgb, var(--gap-low) 20%, transparent); }
.badge[data-bucket="medium"] { background: color-mix(in srgb, var(--gap-mid) 28%, transparent); }
.badge[data-bucket="high"] { background: color-mix(in srgb, var(--gap-high) 26%, transparent); }
```

- [ ] **Step 2: `components/insight/RegionPanel.tsx`**

```tsx
'use client';
import { useLocale, useTranslations } from 'next-intl';
import { getRegion, getRestaurant } from '@/lib/mockData';
import { formatCount, formatGapIndex, formatPercent } from '@/lib/format';
import type { Locale } from '@/lib/types';
import styles from './RegionPanel.module.css';

export function RegionPanel({ code, onClose }: { code: string; onClose: () => void }) {
  const t = useTranslations('insight');
  const tc = useTranslations('common');
  const locale = useLocale() as Locale;
  const region = getRegion(code);
  if (!region) return null;
  return (
    <aside className={styles.panel} aria-label={region.name[locale] ?? region.name.en}>
      <div className={styles.head}>
        <h2>{region.name[locale] ?? region.name.en}</h2>
        <button onClick={onClose} aria-label={tc('close')}>{'×'}</button>
      </div>
      <dl className={styles.stats}>
        <div><dt>{t('demand')}</dt><dd className="tnum">{formatCount(region.demandScore, locale)}</dd></div>
        <div><dt>{t('supply')}</dt><dd className="tnum">{formatCount(region.supplyCount, locale)}</dd></div>
        <div><dt>{t('gapIndex')}</dt><dd className="tnum">{formatGapIndex(region.gapIndex, locale)}</dd></div>
        <div><dt>{t('trend')}</dt><dd className="tnum">{formatPercent(region.trendVs2019, locale)}</dd></div>
      </dl>
      <h3>{t('topCandidates')}</h3>
      <ul>
        {region.topCandidateIds.map((id) => {
          const r = getRestaurant(id);
          return r ? <li key={id}>{r.name[locale] ?? r.name.en}</li> : null;
        })}
      </ul>
    </aside>
  );
}
```

`RegionPanel.module.css`:

```css
.panel { position: absolute; inset-block: var(--space-4); inset-inline-end: var(--space-4); inline-size: min(340px, 90vw); background: var(--paper-raised); border: 1px solid var(--line); border-radius: var(--radius-md); padding: var(--space-4); overflow-y: auto; box-shadow: var(--shadow-1); }
.head { display: flex; justify-content: space-between; align-items: start; }
.head button { background: none; border: 0; font-size: 20px; cursor: pointer; color: var(--ink); }
.stats { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); margin-block: var(--space-4); }
.stats dt { font-size: 12px; color: var(--ink-soft); }
.stats dd { margin: 0; font-size: 20px; font-weight: 700; }
```

- [ ] **Step 3: `app/[locale]/insight/InsightView.tsx`**

```tsx
'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChoroplethMap } from '@/components/map/ChoroplethMap';
import { RegionList } from '@/components/insight/RegionList';
import { RegionPanel } from '@/components/insight/RegionPanel';
import { getRegions } from '@/lib/mockData';
import styles from './insight.module.css';

type Layer = 'gap' | 'demand' | 'supply';

export function InsightView() {
  const t = useTranslations('insight');
  const [layer, setLayer] = useState<Layer>('gap');
  const [picked, setPicked] = useState<string | undefined>();
  const regions = getRegions();

  return (
    <div className={styles.view}>
      <div className={styles.side}>
        <div className={styles.layers} role="group" aria-label="Layer">
          {(['gap', 'demand', 'supply'] as Layer[]).map((l) => (
            <button key={l} data-on={layer === l} onClick={() => setLayer(l)}>
              {l === 'gap' ? t('layerGap') : l === 'demand' ? t('layerDemand') : t('layerSupply')}
            </button>
          ))}
        </div>
        <RegionList regions={regions} onPick={setPicked} selected={picked} />
      </div>
      <div className={styles.mapWrap}>
        <ChoroplethMap layer={layer} onPick={setPicked} />
        {picked && <RegionPanel code={picked} onClose={() => setPicked(undefined)} />}
      </div>
    </div>
  );
}
```

`app/[locale]/insight/insight.module.css`:

```css
.view { display: grid; grid-template-columns: 300px 1fr; gap: var(--space-4); block-size: calc(100dvh - 64px); padding: var(--space-4) var(--space-6); }
.side { display: flex; flex-direction: column; min-block-size: 0; }
.layers { display: flex; gap: var(--space-1); margin-block-end: var(--space-2); }
.layers button { flex: 1; padding: 6px; font-size: 12px; border: 1px solid var(--line); background: var(--paper-raised); border-radius: var(--radius-sm); cursor: pointer; color: var(--ink-soft); }
.layers button[data-on="true"] { color: var(--primary); border-color: var(--primary); font-weight: 700; }
.mapWrap { position: relative; }
@media (max-width: 900px) { .view { grid-template-columns: 1fr; } }
```

- [ ] **Step 4: `app/[locale]/insight/page.tsx`**

```tsx
import { setRequestLocale } from 'next-intl/server';
import { InsightView } from './InsightView';

export default async function InsightPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <InsightView />;
}
```

- [ ] **Step 5: `components/insight/RegionList.test.tsx`**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import messages from '@/messages/en.json';
import { RegionList } from './RegionList';
import type { RegionGap } from '@/lib/types';

const regions: RegionGap[] = [
  { code: 'a', name: { en: 'Alpha', ko: 'a' }, gwangyeok: 'X', demandScore: 1, supplyCount: 1, gapIndex: 20, trendVs2019: 0 },
  { code: 'b', name: { en: 'Bravo', ko: 'b' }, gwangyeok: 'X', demandScore: 1, supplyCount: 1, gapIndex: 90, trendVs2019: 0 },
];

describe('RegionList', () => {
  it('sorts by gap index descending and fires onPick', async () => {
    const onPick = vi.fn();
    render(<NextIntlClientProvider locale="en" messages={messages}><RegionList regions={regions} onPick={onPick} /></NextIntlClientProvider>);
    const rows = screen.getAllByRole('button');
    expect(rows[0]).toHaveTextContent('Bravo');
    await userEvent.click(rows[0]);
    expect(onPick).toHaveBeenCalledWith('b');
  });
});
```

- [ ] **Step 6: Run** `npm test -- RegionList` — Expected: 1 passed.

- [ ] **Step 7: Verify** — `/en/insight`: map + list; click list row → panel opens and map is unaffected; click map region → same panel; layer buttons recolor the map. Check `/ar/insight` panel sits on the inline-end (left) side. Stop server.

- [ ] **Step 8: Commit**

```bash
cd /Users/takyerin/claude && git add plately/plately-web && git commit -m "feat(plately): insight gap map, region panel, accessible region list"
```

---

### Task 24: Rankings table

**Files:**
- Create: `components/insight/RankingsTable.tsx` (+ css), `components/insight/RankingsTable.test.tsx`
- Create: `app/[locale]/insight/rankings/page.tsx`

- [ ] **Step 1: `components/insight/RankingsTable.tsx`**

```tsx
'use client';
import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { getRegions } from '@/lib/mockData';
import { formatCount, formatGapIndex, formatPercent } from '@/lib/format';
import type { Locale } from '@/lib/types';
import styles from './RankingsTable.module.css';

type SortKey = 'gapIndex' | 'demandScore' | 'supplyCount' | 'trendVs2019';

export function RankingsTable() {
  const t = useTranslations('insight');
  const locale = useLocale() as Locale;
  const [sort, setSort] = useState<SortKey>('gapIndex');
  const [gwangyeok, setGwangyeok] = useState<string>('all');

  const all = getRegions();
  const gwangyeoks = useMemo(() => ['all', ...Array.from(new Set(all.map((r) => r.gwangyeok))).sort()], [all]);
  const rows = useMemo(() => {
    let list = gwangyeok === 'all' ? all : all.filter((r) => r.gwangyeok === gwangyeok);
    return [...list].sort((a, b) => b[sort] - a[sort]);
  }, [all, sort, gwangyeok]);

  return (
    <div className={styles.wrap}>
      <label>
        {'光域市道'}
        <select value={gwangyeok} onChange={(e) => setGwangyeok(e.target.value)}>
          {gwangyeoks.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
      </label>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>#</th>
            <th>{t('gapMap')}</th>
            {(['gapIndex', 'demandScore', 'supplyCount', 'trendVs2019'] as SortKey[]).map((k) => (
              <th key={k}><button onClick={() => setSort(k)} data-on={sort === k}>{t(
                k === 'gapIndex' ? 'gapIndex' : k === 'demandScore' ? 'demand' : k === 'supplyCount' ? 'supply' : 'trend',
              )}</button></th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.code}>
              <td className="tnum">{i + 1}</td>
              <td>{r.name[locale] ?? r.name.en}</td>
              <td className="tnum">{formatGapIndex(r.gapIndex, locale)}</td>
              <td className="tnum">{formatCount(r.demandScore, locale)}</td>
              <td className="tnum">{formatCount(r.supplyCount, locale)}</td>
              <td className="tnum">{formatPercent(r.trendVs2019, locale)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

`RankingsTable.module.css`:

```css
.wrap { padding: var(--space-6); overflow-x: auto; }
.table { inline-size: 100%; border-collapse: collapse; }
.table th, .table td { text-align: start; padding: var(--space-2) var(--space-3); border-block-end: 1px solid var(--line); }
.table th button { background: none; border: 0; font: inherit; font-weight: 700; cursor: pointer; color: var(--ink-soft); }
.table th button[data-on="true"] { color: var(--primary); }
```

- [ ] **Step 2: `app/[locale]/insight/rankings/page.tsx`**

```tsx
import { setRequestLocale } from 'next-intl/server';
import { RankingsTable } from '@/components/insight/RankingsTable';

export default async function RankingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <RankingsTable />;
}
```

- [ ] **Step 3: `components/insight/RankingsTable.test.tsx`**

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import messages from '@/messages/en.json';
import { RankingsTable } from './RankingsTable';

describe('RankingsTable', () => {
  it('defaults to gap-index descending order', () => {
    render(<NextIntlClientProvider locale="en" messages={messages}><RankingsTable /></NextIntlClientProvider>);
    const body = screen.getAllByRole('rowgroup')[1];
    const firstRowCells = within(within(body).getAllByRole('row')[0]).getAllByRole('cell');
    const secondRowCells = within(within(body).getAllByRole('row')[1]).getAllByRole('cell');
    expect(Number(firstRowCells[2].textContent)).toBeGreaterThanOrEqual(Number(secondRowCells[2].textContent));
  });
});
```

- [ ] **Step 4: Run** `npm test -- RankingsTable` — Expected: 1 passed.

- [ ] **Step 5: Commit**

```bash
cd /Users/takyerin/claude && git add plately/plately-web && git commit -m "feat(plately): insight rankings table"
```

---

### Task 25: Compare (three regions) page

**Files:**
- Create: `components/insight/CompareColumn.tsx` (+ css)
- Create: `app/[locale]/insight/compare/page.tsx`

- [ ] **Step 1: `components/insight/CompareColumn.tsx`**

```tsx
import { getTranslations } from 'next-intl/server';
import { formatCount, formatGapIndex, formatPercent } from '@/lib/format';
import type { RegionGap, Locale } from '@/lib/types';
import styles from './CompareColumn.module.css';

export async function CompareColumn({
  region, kind, prescription, locale,
}: {
  region: RegionGap; kind: 'saturated' | 'growing' | 'empty';
  prescription: string; locale: Locale;
}) {
  const t = await getTranslations('insight');
  return (
    <section className={styles.col} data-kind={kind}>
      <span className={styles.tag}>{t(kind)}</span>
      <h2>{region.name[locale] ?? region.name.en}</h2>
      <dl className={styles.stats}>
        <div><dt>{t('demand')}</dt><dd className="tnum">{formatCount(region.demandScore, locale)}</dd></div>
        <div><dt>{t('supply')}</dt><dd className="tnum">{formatCount(region.supplyCount, locale)}</dd></div>
        <div><dt>{t('gapIndex')}</dt><dd className="tnum">{formatGapIndex(region.gapIndex, locale)}</dd></div>
        <div><dt>{t('trend')}</dt><dd className="tnum">{formatPercent(region.trendVs2019, locale)}</dd></div>
      </dl>
      <div className={styles.bar} aria-hidden>
        <span style={{ inlineSize: `${region.demandScore}%` }} data-role="demand" />
        <span style={{ inlineSize: `${Math.min(100, region.supplyCount * 5)}%` }} data-role="supply" />
      </div>
      <p className={styles.rx}><strong>{t('prescription')}:</strong> {prescription}</p>
    </section>
  );
}
```

`CompareColumn.module.css`:

```css
.col { border: 1px solid var(--line); border-radius: var(--radius-lg); padding: var(--space-6); background: var(--paper-raised); }
.col[data-kind="empty"] { border-color: var(--gap-high); }
.col[data-kind="growing"] { border-color: var(--gap-mid); }
.col[data-kind="saturated"] { border-color: var(--gap-low); }
.tag { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--ink-soft); }
.stats { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); margin-block: var(--space-4); }
.stats dt { font-size: 12px; color: var(--ink-soft); }
.stats dd { margin: 0; font-size: 22px; font-weight: 700; }
.bar { display: flex; flex-direction: column; gap: 4px; margin-block: var(--space-3); }
.bar span { block-size: 8px; border-radius: 999px; }
.bar span[data-role="demand"] { background: var(--accent); }
.bar span[data-role="supply"] { background: var(--primary); }
.rx { font-size: 14px; }
```

- [ ] **Step 2: `app/[locale]/insight/compare/page.tsx`**

```tsx
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { getComparisonRegions } from '@/lib/mockData';
import { CompareColumn } from '@/components/insight/CompareColumn';
import type { Locale } from '@/lib/types';
import styles from './compare.module.css';

export default async function ComparePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('insight');
  const [seoul, busan, gap] = getComparisonRegions();
  const l = locale as Locale;

  return (
    <div className={styles.wrap}>
      <p className={styles.intro}>{t('compareIntro')}</p>
      <div className={styles.grid}>
        <CompareColumn region={seoul} kind="saturated" prescription={t('rxSaturated' as never)} locale={l} />
        <CompareColumn region={busan} kind="growing" prescription={t('rxGrowing' as never)} locale={l} />
        <CompareColumn region={gap} kind="empty" prescription={t('rxEmpty' as never)} locale={l} />
      </div>
    </div>
  );
}
```

Add `rxSaturated` / `rxGrowing` / `rxEmpty` keys to all four message catalogs (short prescription sentences from spec §5.3 ⑥).

`app/[locale]/insight/compare/compare.module.css`:

```css
.wrap { padding: var(--space-8) var(--space-6); max-inline-size: 1100px; margin-inline: auto; }
.intro { font-size: 20px; font-weight: 700; margin-block-end: var(--space-6); }
.grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-4); }
@media (max-width: 900px) { .grid { grid-template-columns: 1fr; } }
```

- [ ] **Step 3: Verify** — `/en/insight/compare` shows three columns; `/ar/insight/compare` reverses column order visually. Stop server.

- [ ] **Step 4: Commit**

```bash
cd /Users/takyerin/claude && git add plately/plately-web && git commit -m "feat(plately): three-region comparison page"
```

---

### Task 26: About / data & method page

**Files:**
- Create: `app/[locale]/insight/about/page.tsx` (+ css)

- [ ] **Step 1: Add `about.*` keys** to all four catalogs: `title`, `sourcesTitle`, `source_localdata`, `source_tourapi`, `source_datalab`, `pipelineTitle`, `pipelineSteps` (array of 5 strings from spec pipeline), `openDataTitle`, `openDataBody`, `limitsTitle`, `limitsBody`.

- [ ] **Step 2: `app/[locale]/insight/about/page.tsx`**

```tsx
import { setRequestLocale, getTranslations } from 'next-intl/server';
import styles from './about.module.css';

export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('about');
  const steps = t.raw('pipelineSteps') as string[];

  return (
    <article className={styles.wrap}>
      <h1>{t('title')}</h1>

      <h2>{t('sourcesTitle')}</h2>
      <ul>
        <li>{t('source_localdata')}</li>
        <li>{t('source_tourapi')}</li>
        <li>{t('source_datalab')}</li>
      </ul>

      <h2>{t('pipelineTitle')}</h2>
      <ol className={styles.pipeline}>{steps.map((s, i) => <li key={i}>{s}</li>)}</ol>

      <h2>{t('openDataTitle')}</h2>
      <p>{t('openDataBody')}</p>

      <h2>{t('limitsTitle')}</h2>
      <p>{t('limitsBody')}</p>
    </article>
  );
}
```

`about.module.css`:

```css
.wrap { max-inline-size: 720px; margin-inline: auto; padding: var(--space-8) var(--space-6) var(--space-12); }
.wrap h2 { font-size: 17px; margin-block: var(--space-6) var(--space-2); }
.pipeline { display: flex; flex-direction: column; gap: var(--space-2); padding-inline-start: var(--space-6); }
```

- [ ] **Step 3: Verify** — `/en/insight/about` and `/ko/insight/about` render translated content, no missing-key console warnings. Stop server.

- [ ] **Step 4: Commit**

```bash
cd /Users/takyerin/claude && git add plately/plately-web && git commit -m "feat(plately): insight about / data & method page"
```

---

## Phase 5 — Cross-cutting verification

### Task 27: Playwright smoke across 4 locales

**Files:**
- Create/replace: `tests/e2e/smoke.spec.ts`

- [ ] **Step 1: Write the suite**

```ts
import { test, expect } from '@playwright/test';

const locales = ['en', 'ko', 'ar', 'hi'] as const;
const paths = ['/explore', '/start', '/insight', '/insight/rankings', '/insight/compare', '/insight/about'];

for (const locale of locales) {
  for (const path of paths) {
    test(`${locale}${path} renders without console errors`, async ({ page }) => {
      const errors: string[] = [];
      page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
      page.on('pageerror', (e) => errors.push(String(e)));
      const res = await page.goto(`/${locale}${path}`);
      expect(res?.status()).toBeLessThan(400);
      await expect(page.locator('header')).toBeVisible();
      // ignore benign tile/font network noise
      const real = errors.filter((e) => !/openfreemap|gstatic|favicon/i.test(e));
      expect(real, real.join('\n')).toEqual([]);
    });
  }
}

test('ar sets dir=rtl on <html>', async ({ page }) => {
  await page.goto('/ar/explore');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
});

test('en sets dir=ltr on <html>', async ({ page }) => {
  await page.goto('/en/explore');
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
});

test('filter chip narrows the result count', async ({ page }) => {
  await page.goto('/en/explore');
  const count = page.getByText(/\d+ places/);
  const before = Number((await count.textContent())!.match(/\d+/)![0]);
  await page.getByRole('button', { name: 'Beef-free', pressed: false }).click();
  await expect
    .poll(async () => Number((await count.textContent())!.match(/\d+/)![0]))
    .toBeLessThanOrEqual(before);
});

test('insight region click opens the panel', async ({ page }) => {
  await page.goto('/en/insight');
  await page.getByRole('button', { name: /gu|si|gun/ }).first().click();
  await expect(page.getByRole('complementary')).toBeVisible();
});
```

- [ ] **Step 2: Run** `npm run e2e` — Expected: all pass. Fix any real console errors surfaced (missing keys, hydration warnings) before moving on.

- [ ] **Step 3: Commit**

```bash
cd /Users/takyerin/claude && git add plately/plately-web && git commit -m "test(plately): 4-locale smoke + RTL + filter + panel e2e"
```

---

### Task 28: Accessibility pass

**Files:**
- Create: `tests/e2e/a11y.spec.ts`

- [ ] **Step 1: Write the axe suite**

```ts
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const routes = ['/en/explore', '/en/start', '/en/insight', '/en/insight/compare', '/ar/explore', '/ko/insight/rankings'];

for (const route of routes) {
  test(`${route} has no serious axe violations`, async ({ page }) => {
    await page.goto(route);
    await page.waitForLoadState('networkidle');
    const results = await new AxeBuilder({ page })
      .disableRules(['region']) // map container is a known landmark gap
      .analyze();
    const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
  });
}
```

- [ ] **Step 2: Run** `npm run e2e -- a11y` — Expected: all pass. Fix contrast/label issues found (adjust tokens or add `aria-label`s).

- [ ] **Step 3: Manual RTL check** — `npm run dev`, walk `/ar/start`, `/ar/explore`, `/ar/insight` and confirm: text aligns to the right, toggles slide the correct way, map controls sit on the left, compare columns reverse. Note anything off and fix with logical properties.

- [ ] **Step 4: Commit**

```bash
cd /Users/takyerin/claude && git add plately/plately-web && git commit -m "test(plately): axe accessibility suite"
```

---

### Task 29: README + final build

**Files:**
- Create: `plately/README.md`
- Create: `plately/plately-web/README.md` (replace generator default)

- [ ] **Step 1: Write `plately/plately-web/README.md`**

Cover: what Plately is (one paragraph), `npm install && npm run dev`, the two modes and their routes, `npm test` / `npm run e2e`, where mock data lives (`lib/mockData.ts`), the real-data seam (`lib/filter.ts` + accessors), how to regenerate region data (`node scripts/gen-region-gap.mjs`) and the GeoJSON (`bash scripts/build-geojson.sh`), the i18n model (add a locale = add to `i18n/routing.ts` + `messages/<l>.json`), and the known `getComparisonRegions` hardcoded codes.

- [ ] **Step 2: Write `plately/README.md`** — short pointer to `plately-web/` plus a note that the Python data pipeline will live alongside it later (mirrors `dajim/`).

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: build succeeds, all `[locale]` routes listed, no type errors.

- [ ] **Step 4: Lint**

Run: `npm run lint && npm run lint:css`
Expected: clean (fix violations — the CSS logical-property rule is the important one).

- [ ] **Step 5: Full test run**

Run: `npm test && npm run e2e`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
cd /Users/takyerin/claude && git add plately && git commit -m "docs(plately): README + finalize v1 UI"
```

---

## Self-Review

**1. Spec coverage**

| Spec section | Task(s) |
| --- | --- |
| §2 two modes + mode switch | 9 (ModeSwitch, layouts), 18/19 (Explore), 23–26 (Insight) |
| §3.1 locale routing, cookie, Accept-Language | 4 (middleware) |
| §3.2 RTL, logical properties | 6, plus per-component CSS in 3, 8, 15, 18–26; verified in 28 |
| §3.3 next-intl, Latin numerals for gap index, fonts | 4, 13 (`formatGapIndex`), 7 |
| §3.4 translation coverage + key-drift guard | 5 (`lib/i18n.test.ts`) |
| §4.1 color tokens | 3 (`tokens.css`) |
| §4.2 gap color scale + colorblind fallback | 13 (`gapScale.ts`), 23 (numeric badges in `RegionList`), map legend TODO folded into 23 |
| §4.3 reduced motion, theme toggle, focus rings | 3, 8 |
| §5.1 shared chrome + bottom tabs | 9 |
| §5.2 ① onboarding | 15, 16 |
| §5.2 ② explore list + filters + confidence badge | 18 |
| §5.2 ② map pins + sync | 19 |
| §5.2 ③ restaurant detail + why-listed + attributes + disclaimer | 20 |
| §5.3 ④ gap map + region panel + layer toggle + accessible list | 21, 22, 23 |
| §5.3 ⑤ rankings table | 24 |
| §5.3 ⑥ three-region compare | 25 |
| §5.3 ⑦ about / data & method | 26 |
| §6.1–6.2 accessors + types | 10 |
| §6.3 filter logic (the seam) | 12 |
| §6.4 OpenFreeMap + bundled GeoJSON | 17, 21 |
| §7 prefs hook, cookie locale, no backend | 14, 4 |
| §8 accessibility, map list alternative | 23, 28 |
| §9 Vitest + Playwright | 2, and tests in every task; 27, 28 |
| §10 tech stack | 1 |
| §11 directory layout | 1, 29 |
| §12 non-scope | respected — no phone-verification UI, no auth, no real algorithm |

Gap found and fixed: the **map legend** for the gap scale was implied by §4.2 but had no task. Fold it into Task 23 Step 3 as part of `InsightView` (a small static legend under the layer buttons showing the green→amber→clay ramp with `low / medium / high` labels).

**2. Placeholder scan** — no "TBD"/"handle edge cases"/"similar to Task N". Two copy artifacts flagged inline for the implementer: `syncРins` → use `syncPins`; the `t('back' as never)` casts are because those keys live under `common`, not `onboarding` — implementer should use `useTranslations('common')` for `back`.

**3. Type consistency** — `Preferences`, `RestaurantFilter`, `Restaurant`, `RegionGap`, `RegionGapDetail` defined once in Task 10 and used unchanged in 12, 14, 18–25. `getRestaurants/getRegions/getRegion/getComparisonRegions` names stable across 10, 18, 22, 23, 24, 25. `gapInterpolateStops` defined in 13, used in 22. `syncPins` (corrected) defined in 19, used in 19.

---

## Execution Handoff

Plan complete and saved to `plately/docs/superpowers/plans/2026-08-27-plately-ui.md`. Two execution options:

1. **Subagent-Driven (recommended)** — a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
