# Plately Login + Profile Onboarding — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make app entry a mandatory `/login → language → profile → detailed profile` gate, with a richer restriction model (Muslim halal-preference tiers + Hindu meat-preference tiers, each presetting per-restriction toggles) that actually filters restaurants.

**Architecture:** Session + preferences live in `localStorage` (demo auth, no backend). A client-side `<OnboardingGate>` in the locale layout redirects unauthenticated/un-onboarded users into the wizard. `RestaurantAttributes` expands from 4 to 14 fields; `RestaurantFilter` becomes a `restrictions` map; `applyRestaurantFilter` excludes only on **confirmed** conflicts (`'unknown'` passes through). Tier→toggle presets live in `lib/tiers.ts`.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, next-intl v4, CSS Modules + design tokens, Vitest + Testing Library, Playwright.

**Spec:** `plately/docs/superpowers/specs/2026-08-27-plately-auth-onboarding-design.md`
**Base branch:** `plately-auth-onboarding` (off `main`). **Working dir:** `/Users/takyerin/claude/plately/plately-web`. **Git root:** `/Users/takyerin` — stage only `plately/` paths; every commit ends with a blank line then `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.

**Standing gates** (run before each commit): `npm test`, `npx tsc --noEmit`, `npm run lint` (0 errors), `npm run lint:css` (green). `npm run build` at phase boundaries. If `tsc` errors on `LayoutProps`/`PageProps` globals, run `npm run build` once to regenerate `.next/types`.

---

## File Structure

```
lib/
  types.ts             # MOD — ProfileKind, RestrictionKey, Session, reworked Preferences, 14-field RestaurantAttributes
  tiers.ts             # NEW — TIER_PRESETS, PROFILE_RESTRICTIONS, tierList()
  useSession.ts        # NEW — demo session hook
  usePreferences.ts    # REWRITE — profile/tier/restrictions/onboarded
  filter.ts            # REWRITE — restriction-map filter + tier requires
  mockData.ts          # MOD — expand all 28 restaurants' attributes
components/onboarding/
  OnboardingSplash.tsx # NEW — neutral loading splash
  OnboardingGate.tsx   # NEW — client redirect guard
  StepShell.tsx        # NEW — shared wizard frame (title + progress + back/next)
  ProfileChoice.tsx    # NEW — Muslim/Hindu cards
  TierSelect.tsx       # NEW — single-select tier list
  RestrictionToggles.tsx # NEW — toggle grid, dim/lock unless custom
components/explore/
  FilterChips.tsx      # MOD — generalize to RestrictionKey
  RestaurantCard.tsx   # MOD — tags from attributes helper
  YourRestrictions.tsx # NEW — detail-page "does this fit you" block
app/[locale]/
  layout.tsx           # MOD — wrap children in <OnboardingGate>
  login/page.tsx       # NEW
  login/LoginForm.tsx  # NEW
  onboarding/layout.tsx      # NEW
  onboarding/language/page.tsx  # NEW
  onboarding/profile/page.tsx + ProfileStep.tsx   # NEW
  onboarding/details/page.tsx + DetailsStep.tsx   # NEW
  start/                # DELETE
  explore/ExploreView.tsx     # MOD
  explore/[id]/page.tsx       # MOD — <YourRestrictions>
messages/{en,ko,ar,hi}.json   # MOD — login, onboarding rework, tiers, restrictions
tests/e2e/onboarding.spec.ts  # NEW
tests/e2e/smoke.spec.ts       # MOD — drop /start, add gate bypass helper
```

---

## Phase A — Data model & logic

### Task 1: Types

**Files:** Modify `lib/types.ts`

- [ ] **Step 1: Replace the `Preferences` interface and expand `RestaurantAttributes`**

Remove the old `Preferences` (`profile: 'muslim'|'hindu'|'porkfree'|'custom'`, `avoidPork`, `avoidAlcohol`, `avoidBeef`, `vegetarianOnly`, `city`). Add:

```ts
export type ProfileKind = 'muslim' | 'hindu';

export type RestrictionKey =
  | 'pork' | 'alcohol' | 'porkDerived' | 'gelatin' | 'nonHalalMeat'
  | 'seafood' | 'crossContamination'
  | 'beef' | 'chicken' | 'fish' | 'eggs' | 'onion' | 'garlic';

export interface Preferences {
  profile: ProfileKind | null;
  tier: string | null;
  restrictions: Partial<Record<RestrictionKey, boolean>>;
  onboarded: boolean;
}

export interface Session {
  email: string | null; // null = guest
  signedInAt: string;   // ISO
}
```

Replace `RestaurantAttributes` with:

```ts
export interface RestaurantAttributes {
  containsPork: boolean;
  servesAlcohol: Tristate;
  containsBeef: boolean;
  vegetarianFriendly: boolean;
  containsChicken: boolean;
  containsFish: boolean;
  containsSeafood: boolean;
  containsEgg: boolean;
  containsOnionGarlic: boolean;
  porkDerivedIngredients: Tristate;
  containsGelatin: Tristate;
  nonHalalMeat: Tristate;
  halalCertified: boolean;
  crossContaminationRisk: Tristate;
}
```

Replace `RestaurantFilter` with:

```ts
export interface RestaurantFilter {
  restrictions?: Partial<Record<RestrictionKey, boolean>>;
  requireHalalCertified?: boolean;
  requireVegetarian?: boolean;
  cuisines?: string[];
  sigunguCode?: string;
}
```

- [ ] **Step 2: Verify** `npx tsc --noEmit` — expect MANY errors in `mockData.ts`, `filter.ts`, `usePreferences.ts`, `ExploreView.tsx`, onboarding — that's expected; later tasks fix them. Do NOT commit yet — commit at the end of Task 2 with `tiers.ts` so the type layer lands together. (If you must commit, note the build is red mid-phase.)

Actually: **commit now** anyway so the diff is reviewable — red build is acceptable mid-phase A.

```bash
cd /Users/takyerin/claude && git add plately/plately-web/lib/types.ts && git commit -m "feat(plately): rework Preferences + expand RestaurantAttributes types"
```

---

### Task 2: `lib/tiers.ts`

**Files:** Create `lib/tiers.ts`, `lib/tiers.test.ts`

- [ ] **Step 1: Write `lib/tiers.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { TIER_PRESETS, PROFILE_RESTRICTIONS, tierList, presetFor } from './tiers';

describe('tiers', () => {
  it('muslim tier list is the 4 halal-preference options', () => {
    expect(tierList('muslim')).toEqual(['halal-certified', 'halal-meat', 'pork-alcohol-free', 'custom']);
  });
  it('hindu tier list is the 5 meat-preference options', () => {
    expect(tierList('hindu')).toEqual(['vegetarian', 'no-beef', 'no-beef-pork', 'no-meat', 'custom']);
  });
  it('pork-alcohol-free presets pork+alcohol+porkDerived', () => {
    expect(presetFor('muslim', 'pork-alcohol-free')).toEqual({ pork: true, alcohol: true, porkDerived: true });
  });
  it('halal-certified presets six restrictions', () => {
    expect(presetFor('muslim', 'halal-certified')).toEqual({
      pork: true, alcohol: true, porkDerived: true, gelatin: true, nonHalalMeat: true, crossContamination: true,
    });
  });
  it('hindu vegetarian presets the five meat/seafood axes', () => {
    expect(presetFor('hindu', 'vegetarian')).toEqual({ beef: true, pork: true, chicken: true, fish: true, seafood: true });
  });
  it('custom preset is empty (user edits)', () => {
    expect(presetFor('muslim', 'custom')).toEqual({});
    expect(presetFor('hindu', 'custom')).toEqual({});
  });
  it('PROFILE_RESTRICTIONS lists the toggles shown per profile', () => {
    expect(PROFILE_RESTRICTIONS.muslim).toEqual(['pork', 'alcohol', 'porkDerived', 'gelatin', 'nonHalalMeat', 'seafood', 'crossContamination']);
    expect(PROFILE_RESTRICTIONS.hindu).toEqual(['beef', 'pork', 'chicken', 'fish', 'seafood', 'eggs', 'onion', 'garlic', 'alcohol', 'crossContamination']);
  });
});
```

- [ ] **Step 2: Run** `npm test -- tiers` — FAIL (no module).

- [ ] **Step 3: Write `lib/tiers.ts`**

```ts
import type { ProfileKind, RestrictionKey } from './types';

export const PROFILE_RESTRICTIONS: Record<ProfileKind, RestrictionKey[]> = {
  muslim: ['pork', 'alcohol', 'porkDerived', 'gelatin', 'nonHalalMeat', 'seafood', 'crossContamination'],
  hindu: ['beef', 'pork', 'chicken', 'fish', 'seafood', 'eggs', 'onion', 'garlic', 'alcohol', 'crossContamination'],
};

type Preset = Partial<Record<RestrictionKey, boolean>>;

export const TIER_PRESETS: Record<ProfileKind, Record<string, Preset>> = {
  muslim: {
    'halal-certified': { pork: true, alcohol: true, porkDerived: true, gelatin: true, nonHalalMeat: true, crossContamination: true },
    'halal-meat': { pork: true, porkDerived: true, nonHalalMeat: true },
    'pork-alcohol-free': { pork: true, alcohol: true, porkDerived: true },
    custom: {},
  },
  hindu: {
    vegetarian: { beef: true, pork: true, chicken: true, fish: true, seafood: true },
    'no-beef': { beef: true },
    'no-beef-pork': { beef: true, pork: true },
    'no-meat': { beef: true, pork: true, chicken: true, fish: true, seafood: true },
    custom: {},
  },
};

export function tierList(profile: ProfileKind): string[] {
  return Object.keys(TIER_PRESETS[profile]);
}

export function presetFor(profile: ProfileKind, tier: string): Preset {
  return TIER_PRESETS[profile][tier] ?? {};
}

export const DEFAULT_TIER: Record<ProfileKind, string> = {
  muslim: 'pork-alcohol-free',
  hindu: 'no-beef-pork',
};
```

- [ ] **Step 4: Run** `npm test -- tiers` — 7 passed.

- [ ] **Step 5: Commit**

```bash
cd /Users/takyerin/claude && git add plately/plately-web/lib/tiers.ts plately/plately-web/lib/tiers.test.ts && git commit -m "feat(plately): tier -> restriction-preset maps"
```

---

### Task 3: `lib/useSession.ts`

**Files:** Create `lib/useSession.ts`, `lib/useSession.test.tsx`

- [ ] **Step 1: Write `lib/useSession.test.tsx`**

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSession } from './useSession';

beforeEach(() => localStorage.clear());

describe('useSession', () => {
  it('has no session initially', () => {
    const { result } = renderHook(() => useSession());
    expect(result.current.session).toBeNull();
  });
  it('signIn with an email creates a session', () => {
    const { result } = renderHook(() => useSession());
    act(() => result.current.signIn('a@b.com'));
    expect(result.current.session?.email).toBe('a@b.com');
    expect(JSON.parse(localStorage.getItem('plately.session')!).email).toBe('a@b.com');
  });
  it('signIn(null) is a guest session', () => {
    const { result } = renderHook(() => useSession());
    act(() => result.current.signIn(null));
    expect(result.current.session).not.toBeNull();
    expect(result.current.session?.email).toBeNull();
  });
  it('signOut clears it', () => {
    const { result } = renderHook(() => useSession());
    act(() => result.current.signIn('a@b.com'));
    act(() => result.current.signOut());
    expect(result.current.session).toBeNull();
    expect(localStorage.getItem('plately.session')).toBeNull();
  });
  it('rehydrates from storage', () => {
    localStorage.setItem('plately.session', JSON.stringify({ email: 'x@y.com', signedInAt: '2026-01-01T00:00:00Z' }));
    const { result } = renderHook(() => useSession());
    expect(result.current.session?.email).toBe('x@y.com');
  });
});
```

- [ ] **Step 2: Run** `npm test -- useSession` — FAIL.

- [ ] **Step 3: Write `lib/useSession.ts`**

```ts
'use client';
import { useCallback, useEffect, useState } from 'react';
import type { Session } from './types';

const KEY = 'plately.session';

function read(): Session | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setSession(read());
    setHydrated(true);
  }, []);

  const signIn = useCallback((email: string | null) => {
    const next: Session = { email, signedInAt: new Date().toISOString() };
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* private mode */ }
    setSession(next);
  }, []);

  const signOut = useCallback(() => {
    try { localStorage.removeItem(KEY); } catch { /* ignore */ }
    setSession(null);
  }, []);

  return { session, hydrated, signIn, signOut };
}
```

- [ ] **Step 4: Run** `npm test -- useSession` — 5 passed.

- [ ] **Step 5: Commit**

```bash
cd /Users/takyerin/claude && git add plately/plately-web/lib/useSession.ts plately/plately-web/lib/useSession.test.tsx && git commit -m "feat(plately): demo session hook"
```

---

### Task 4: Rewrite `lib/usePreferences.ts`

**Files:** Rewrite `lib/usePreferences.ts`, rewrite `lib/usePreferences.test.tsx`

- [ ] **Step 1: Rewrite `lib/usePreferences.test.tsx`**

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePreferences, DEFAULT_PREFERENCES } from './usePreferences';

beforeEach(() => localStorage.clear());

describe('usePreferences', () => {
  it('starts from defaults', () => {
    const { result } = renderHook(() => usePreferences());
    expect(result.current.prefs).toEqual(DEFAULT_PREFERENCES);
    expect(result.current.prefs.onboarded).toBe(false);
  });
  it('setProfile sets profile + default tier + its preset restrictions', () => {
    const { result } = renderHook(() => usePreferences());
    act(() => result.current.setProfile('muslim'));
    expect(result.current.prefs.profile).toBe('muslim');
    expect(result.current.prefs.tier).toBe('pork-alcohol-free');
    expect(result.current.prefs.restrictions).toEqual({ pork: true, alcohol: true, porkDerived: true });
  });
  it('setTier applies that tier preset', () => {
    const { result } = renderHook(() => usePreferences());
    act(() => result.current.setProfile('muslim'));
    act(() => result.current.setTier('halal-certified'));
    expect(result.current.prefs.tier).toBe('halal-certified');
    expect(result.current.prefs.restrictions.gelatin).toBe(true);
    expect(result.current.prefs.restrictions.nonHalalMeat).toBe(true);
  });
  it('toggleRestriction flips one key (used in custom tier)', () => {
    const { result } = renderHook(() => usePreferences());
    act(() => result.current.setProfile('hindu'));
    act(() => result.current.setTier('custom'));
    act(() => result.current.toggleRestriction('eggs'));
    expect(result.current.prefs.restrictions.eggs).toBe(true);
    act(() => result.current.toggleRestriction('eggs'));
    expect(result.current.prefs.restrictions.eggs).toBe(false);
  });
  it('completeOnboarding sets the flag', () => {
    const { result } = renderHook(() => usePreferences());
    act(() => result.current.setProfile('muslim'));
    act(() => result.current.completeOnboarding());
    expect(result.current.prefs.onboarded).toBe(true);
  });
  it('persists + rehydrates', () => {
    const { result, unmount } = renderHook(() => usePreferences());
    act(() => result.current.setProfile('hindu'));
    act(() => result.current.completeOnboarding());
    unmount();
    const again = renderHook(() => usePreferences());
    expect(again.result.current.prefs.profile).toBe('hindu');
    expect(again.result.current.prefs.onboarded).toBe(true);
  });
  it('resetOnboarding clears profile/tier/restrictions/flag', () => {
    const { result } = renderHook(() => usePreferences());
    act(() => result.current.setProfile('muslim'));
    act(() => result.current.completeOnboarding());
    act(() => result.current.resetOnboarding());
    expect(result.current.prefs).toEqual(DEFAULT_PREFERENCES);
  });
});
```

- [ ] **Step 2: Run** `npm test -- usePreferences` — FAIL (old API).

- [ ] **Step 3: Rewrite `lib/usePreferences.ts`**

```ts
'use client';
import { useCallback, useEffect, useState } from 'react';
import type { Preferences, ProfileKind, RestrictionKey } from './types';
import { presetFor, DEFAULT_TIER } from './tiers';

const KEY = 'plately.prefs';

export const DEFAULT_PREFERENCES: Preferences = {
  profile: null,
  tier: null,
  restrictions: {},
  onboarded: false,
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

  const setProfile = useCallback((profile: ProfileKind) => {
    const tier = DEFAULT_TIER[profile];
    persist({ ...read(), profile, tier, restrictions: { ...presetFor(profile, tier) } });
  }, [persist]);

  const setTier = useCallback((tier: string) => {
    const cur = read();
    if (!cur.profile) return;
    const restrictions = tier === 'custom' ? cur.restrictions : { ...presetFor(cur.profile, tier) };
    persist({ ...cur, tier, restrictions });
  }, [persist]);

  const toggleRestriction = useCallback((key: RestrictionKey) => {
    const cur = read();
    persist({ ...cur, restrictions: { ...cur.restrictions, [key]: !cur.restrictions[key] } });
  }, [persist]);

  const completeOnboarding = useCallback(() => {
    persist({ ...read(), onboarded: true });
  }, [persist]);

  const resetOnboarding = useCallback(() => {
    persist({ ...DEFAULT_PREFERENCES });
  }, [persist]);

  return { prefs, hydrated, setProfile, setTier, toggleRestriction, completeOnboarding, resetOnboarding };
}
```

- [ ] **Step 4: Run** `npm test -- usePreferences` — 8 passed.

- [ ] **Step 5: Commit**

```bash
cd /Users/takyerin/claude && git add plately/plately-web/lib/usePreferences.ts plately/plately-web/lib/usePreferences.test.tsx && git commit -m "feat(plately): rework usePreferences for profile/tier/restrictions"
```

---

### Task 5: Rewrite `lib/filter.ts`

**Files:** Rewrite `lib/filter.ts`, rewrite `lib/filter.test.ts`

- [ ] **Step 1: Rewrite `lib/filter.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { applyRestaurantFilter, filterFromPreferences } from './filter';
import type { Restaurant, RestaurantAttributes, Preferences } from './types';

const ATTR: RestaurantAttributes = {
  containsPork: false, servesAlcohol: false, containsBeef: false, vegetarianFriendly: false,
  containsChicken: false, containsFish: false, containsSeafood: false, containsEgg: false,
  containsOnionGarlic: false, porkDerivedIngredients: false, containsGelatin: false,
  nonHalalMeat: false, halalCertified: false, crossContaminationRisk: false,
};
const mk = (id: string, over: Partial<RestaurantAttributes>): Restaurant => ({
  id, name: { en: id, ko: id }, area: { en: 'a', ko: 'a' }, sigunguCode: '11010',
  coords: [127, 37], cuisine: 'korean', confidence: 'name', matchedTokens: [], repMenu: [],
  attributes: { ...ATTR, ...over },
});

describe('applyRestaurantFilter', () => {
  it('empty filter keeps everything', () => {
    const list = [mk('a', {}), mk('b', { containsPork: true })];
    expect(applyRestaurantFilter(list, {}).length).toBe(2);
  });
  it('restriction pork excludes confirmed pork, keeps unknown-free', () => {
    const list = [mk('clean', {}), mk('pork', { containsPork: true })];
    expect(applyRestaurantFilter(list, { restrictions: { pork: true } }).map((r) => r.id)).toEqual(['clean']);
  });
  it('Tristate porkDerived: true excludes, "unknown" passes', () => {
    const list = [mk('yes', { porkDerivedIngredients: true }), mk('maybe', { porkDerivedIngredients: 'unknown' }), mk('no', { porkDerivedIngredients: false })];
    expect(applyRestaurantFilter(list, { restrictions: { porkDerived: true } }).map((r) => r.id)).toEqual(['maybe', 'no']);
  });
  it('onion OR garlic both map to containsOnionGarlic', () => {
    const list = [mk('og', { containsOnionGarlic: true }), mk('plain', {})];
    expect(applyRestaurantFilter(list, { restrictions: { garlic: true } }).map((r) => r.id)).toEqual(['plain']);
    expect(applyRestaurantFilter(list, { restrictions: { onion: true } }).map((r) => r.id)).toEqual(['plain']);
  });
  it('requireHalalCertified keeps only certified', () => {
    const list = [mk('cert', { halalCertified: true }), mk('not', {})];
    expect(applyRestaurantFilter(list, { requireHalalCertified: true }).map((r) => r.id)).toEqual(['cert']);
  });
  it('requireVegetarian keeps only vegetarianFriendly', () => {
    const list = [mk('veg', { vegetarianFriendly: true }), mk('not', {})];
    expect(applyRestaurantFilter(list, { requireVegetarian: true }).map((r) => r.id)).toEqual(['veg']);
  });
  it('cuisines + sigunguCode still work', () => {
    const list = [mk('a', {}), { ...mk('b', {}), cuisine: 'seafood' }];
    expect(applyRestaurantFilter(list, { cuisines: ['seafood'] }).map((r) => r.id)).toEqual(['b']);
  });
});

describe('filterFromPreferences', () => {
  const base: Preferences = { profile: 'muslim', tier: 'pork-alcohol-free', restrictions: { pork: true, alcohol: true }, onboarded: true };
  it('passes restrictions through', () => {
    expect(filterFromPreferences(base).restrictions).toEqual({ pork: true, alcohol: true });
  });
  it('halal-certified tier sets requireHalalCertified', () => {
    expect(filterFromPreferences({ ...base, tier: 'halal-certified' }).requireHalalCertified).toBe(true);
  });
  it('hindu vegetarian tier sets requireVegetarian', () => {
    expect(filterFromPreferences({ profile: 'hindu', tier: 'vegetarian', restrictions: {}, onboarded: true }).requireVegetarian).toBe(true);
  });
  it('null profile → empty filter', () => {
    expect(filterFromPreferences({ profile: null, tier: null, restrictions: {}, onboarded: false })).toEqual({ restrictions: {}, requireHalalCertified: false, requireVegetarian: false });
  });
});
```

- [ ] **Step 2: Run** `npm test -- filter` — FAIL.

- [ ] **Step 3: Rewrite `lib/filter.ts`**

```ts
import type { Restaurant, RestaurantFilter, Preferences, RestrictionKey, RestaurantAttributes } from './types';

type Rule = (a: RestaurantAttributes) => boolean; // true = conflict → exclude

const RULES: Record<RestrictionKey, Rule> = {
  pork: (a) => a.containsPork === true,
  alcohol: (a) => a.servesAlcohol === true,
  porkDerived: (a) => a.porkDerivedIngredients === true,
  gelatin: (a) => a.containsGelatin === true,
  nonHalalMeat: (a) => a.nonHalalMeat === true,
  seafood: (a) => a.containsSeafood === true,
  crossContamination: (a) => a.crossContaminationRisk === true,
  beef: (a) => a.containsBeef === true,
  chicken: (a) => a.containsChicken === true,
  fish: (a) => a.containsFish === true,
  eggs: (a) => a.containsEgg === true,
  onion: (a) => a.containsOnionGarlic === true,
  garlic: (a) => a.containsOnionGarlic === true,
};

export function applyRestaurantFilter(list: Restaurant[], f: RestaurantFilter): Restaurant[] {
  const active = Object.entries(f.restrictions ?? {})
    .filter(([, on]) => on)
    .map(([k]) => k as RestrictionKey);
  return list.filter((r) => {
    const a = r.attributes;
    if (f.requireHalalCertified && a.halalCertified !== true) return false;
    if (f.requireVegetarian && a.vegetarianFriendly !== true) return false;
    for (const key of active) if (RULES[key](a)) return false;
    if (f.cuisines && f.cuisines.length > 0 && !f.cuisines.includes(r.cuisine)) return false;
    if (f.sigunguCode && r.sigunguCode !== f.sigunguCode) return false;
    return true;
  });
}

export function filterFromPreferences(p: Preferences): RestaurantFilter {
  return {
    restrictions: p.restrictions ?? {},
    requireHalalCertified: p.profile === 'muslim' && p.tier === 'halal-certified',
    requireVegetarian: p.profile === 'hindu' && p.tier === 'vegetarian',
  };
}
```

- [ ] **Step 4: Run** `npm test -- filter` — all pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/takyerin/claude && git add plately/plately-web/lib/filter.ts plately/plately-web/lib/filter.test.ts && git commit -m "feat(plately): restriction-map filter with tier requires"
```

---

### Task 6: Expand mock data attributes

**Files:** Modify `lib/mockData.ts`, modify `lib/mockData.test.ts`

- [ ] **Step 1: Add per-restaurant attribute fields.** Every restaurant's `attributes` object must now have all 14 keys. Derive from `cuisine` using this template, then adjust obvious cases:

| cuisine | chicken | fish | seafood | egg | onionGarlic | porkDerived | gelatin | nonHalalMeat | halalCertified | crossContam |
|---|---|---|---|---|---|---|---|---|---|---|
| `korean` (generic) | false | false | false | false | true | `'unknown'` | false | `true` | false | `'unknown'` |
| `korean-chicken` | true | false | false | false | true | `'unknown'` | false | true | false | false |
| `korean-beef` | false | false | false | false | true | `'unknown'` | false | true | false | false |
| `seafood` | false | true | true | false | true | false | false | false | false | false |
| `temple` | false | false | false | false | **false** | false | false | false | false | false |
| `halal` | true | false | `varies` | true | true | false | false | **false** | **true** | false |
| `middle-eastern` | true | false | false | true | true | false | `'unknown'` | `'unknown'` | false | false |
| `indian` | true | false | false | true | true | false | `'unknown'` | `'unknown'` | false | false |

Rules on top of the template:
- If `confidence: 'phone'`, replace any `'unknown'` in the Tristate fields with a definite `false` (phone verification resolved it) EXCEPT keep `crossContaminationRisk` honest per venue.
- Keep the existing `containsPork`, `servesAlcohol`, `containsBeef`, `vegetarianFriendly` values.
- `temple` (사찰음식): `vegetarianFriendly: true`, everything meat/fish/egg/onionGarlic `false`.
- The 2 `halal` venues: `halalCertified: true`.
- Give ~2 venues a `crossContaminationRisk: true` (e.g. a `seafood` place with a shared grill) and ~3 a `'unknown'`.

Example (full, for the first restaurant — a `korean-chicken` phone-verified 삼계탕):

```ts
attributes: {
  containsPork: false, servesAlcohol: false, containsBeef: false, vegetarianFriendly: false,
  containsChicken: true, containsFish: false, containsSeafood: false, containsEgg: false,
  containsOnionGarlic: true, porkDerivedIngredients: false, containsGelatin: false,
  nonHalalMeat: true, halalCertified: false, crossContaminationRisk: false,
},
```

Example (a `halal` kebab place):

```ts
attributes: {
  containsPork: false, servesAlcohol: false, containsBeef: true, vegetarianFriendly: false,
  containsChicken: true, containsFish: false, containsSeafood: false, containsEgg: true,
  containsOnionGarlic: true, porkDerivedIngredients: false, containsGelatin: false,
  nonHalalMeat: false, halalCertified: true, crossContaminationRisk: false,
},
```

- [ ] **Step 2: Update `lib/mockData.test.ts`** — add:

```ts
it('every restaurant has all 14 attribute keys', () => {
  const keys = ['containsPork','servesAlcohol','containsBeef','vegetarianFriendly','containsChicken','containsFish','containsSeafood','containsEgg','containsOnionGarlic','porkDerivedIngredients','containsGelatin','nonHalalMeat','halalCertified','crossContaminationRisk'];
  for (const r of RESTAURANTS) for (const k of keys) expect(r.attributes).toHaveProperty(k);
});
it('at least one halal-certified venue exists', () => {
  expect(RESTAURANTS.some((r) => r.attributes.halalCertified)).toBe(true);
});
it('at least one vegetarianFriendly venue exists', () => {
  expect(RESTAURANTS.some((r) => r.attributes.vegetarianFriendly)).toBe(true);
});
```

- [ ] **Step 3: Run** `npm test -- mockData` — all pass. Then full `npm test` and `npx tsc --noEmit` — the type layer should now be consistent for `lib/`; UI files (`ExploreView`, onboarding) may still error — that's Phase C. If `ExploreView.tsx` blocks `tsc`, that's expected; note it.

- [ ] **Step 4: Commit**

```bash
cd /Users/takyerin/claude && git add plately/plately-web/lib/mockData.ts plately/plately-web/lib/mockData.test.ts && git commit -m "feat(plately): expand mock restaurant attributes to 14 fields"
```

---

## Phase B — Onboarding UI

### Task 7: Onboarding message keys

**Files:** Modify `messages/{en,ko,ar,hi}.json`

- [ ] **Step 1: Add to all 4 catalogs** (translate ko/ar/hi properly). Replace the existing `onboarding` object; add `login`, `tiers`, `restrictions`; add two keys to `restaurant`.

`en.json` additions:

```json
"login": {
  "title": "Sign in to Plately",
  "subtitle": "Demo — no real account needed.",
  "emailLabel": "Email",
  "passwordLabel": "Password",
  "signIn": "Sign in",
  "guest": "Continue as guest"
},
"onboarding": {
  "languageTitle": "Choose your language",
  "profileTitle": "Create your profile",
  "profileMuslim": "Muslim",
  "profileHindu": "Hindu",
  "detailsTitleMuslim": "Your halal preferences",
  "detailsTitleHindu": "Your dietary preferences",
  "halalPrefTitle": "Halal preference",
  "meatPrefTitle": "Meat preference",
  "detailedTitle": "Detailed restrictions",
  "customHint": "Choose \"Custom\" to edit each item.",
  "back": "Back",
  "next": "Next",
  "done": "Start exploring",
  "stepOf": "Step {n} of {total}"
},
"tiers": {
  "muslim": {
    "halal-certified": "Halal-certified only",
    "halal-meat": "Halal meat required",
    "pork-alcohol-free": "Pork & alcohol free",
    "custom": "Custom"
  },
  "hindu": {
    "vegetarian": "Vegetarian",
    "no-beef": "No beef",
    "no-beef-pork": "No beef/pork",
    "no-meat": "No meat",
    "custom": "Custom"
  }
},
"restrictions": {
  "pork": "Pork",
  "alcohol": "Alcohol in food",
  "porkDerived": "Pork-derived ingredients",
  "gelatin": "Gelatin",
  "nonHalalMeat": "Non-halal meat",
  "seafood": "Seafood",
  "crossContamination": "Cross-contamination",
  "beef": "Beef",
  "chicken": "Chicken",
  "fish": "Fish",
  "eggs": "Eggs",
  "onion": "Onion",
  "garlic": "Garlic"
}
```

`restaurant` object — add:

```json
"yourRestrictions": "Your restrictions",
"restrictionClear": "Looks clear",
"restrictionUnknown": "Check with the venue"
```

Remove the now-unused old `onboarding` keys (`step1Title`, `muslim`, `muslimDesc`, `hindu`, `hinduDesc`, `porkfree`, `custom`, `alcoholToggle`, `vegToggle`, `step2Title`, `nearMe`, `skip`).

- [ ] **Step 2: Run** `npm test -- i18n` — key parity passes (all 4 catalogs identical structure, incl. nested `tiers.muslim.*`).

- [ ] **Step 3: Commit**

```bash
cd /Users/takyerin/claude && git add plately/plately-web/messages && git commit -m "feat(plately): i18n keys for login + reworked onboarding + tiers + restrictions"
```

---

### Task 8: `OnboardingSplash` + `OnboardingGate`

**Files:** Create `components/onboarding/OnboardingSplash.tsx` (+ css), `components/onboarding/OnboardingGate.tsx`, `components/onboarding/OnboardingGate.test.tsx`

- [ ] **Step 1: `OnboardingSplash.tsx`**

```tsx
import styles from './OnboardingSplash.module.css';
export function OnboardingSplash() {
  return (
    <div className={styles.splash} role="status" aria-live="polite">
      <span className={styles.mark}>Plately</span>
    </div>
  );
}
```

`OnboardingSplash.module.css`:

```css
.splash { min-block-size: 100dvh; display: flex; align-items: center; justify-content: center; background: var(--paper); }
.mark { font-weight: 800; font-size: 22px; color: var(--ink-soft); letter-spacing: 0.02em; }
```

- [ ] **Step 2: `OnboardingGate.tsx`**

```tsx
'use client';
import { useEffect } from 'react';
import { usePathname, useRouter } from '@/i18n/navigation';
import { useSession } from '@/lib/useSession';
import { usePreferences } from '@/lib/usePreferences';
import { OnboardingSplash } from './OnboardingSplash';

const EXEMPT = /^\/(login|onboarding)(\/|$)/;

export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname(); // locale-stripped, e.g. "/explore", "/login"
  const router = useRouter();
  const { session, hydrated: sh } = useSession();
  const { prefs, hydrated: ph } = usePreferences();
  const ready = sh && ph;
  const exempt = EXEMPT.test(pathname);

  useEffect(() => {
    if (!ready || exempt) return;
    if (!session) { router.replace('/login'); return; }
    if (!prefs.onboarded) {
      router.replace(prefs.profile ? '/onboarding/details' : '/onboarding/profile');
    }
  }, [ready, exempt, session, prefs.onboarded, prefs.profile, router]);

  if (exempt) return <>{children}</>;
  if (!ready) return <OnboardingSplash />;
  if (!session || !prefs.onboarded) return <OnboardingSplash />;
  return <>{children}</>;
}
```

- [ ] **Step 3: `OnboardingGate.test.tsx`**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const replace = vi.fn();
let pathname = '/explore';
vi.mock('@/i18n/navigation', () => ({
  usePathname: () => pathname,
  useRouter: () => ({ replace }),
}));

import { OnboardingGate } from './OnboardingGate';

beforeEach(() => { localStorage.clear(); replace.mockClear(); pathname = '/explore'; });

describe('OnboardingGate', () => {
  it('redirects to /login when no session', async () => {
    render(<OnboardingGate><div>APP</div></OnboardingGate>);
    // effect runs after hydration microtask
    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
    expect(screen.queryByText('APP')).toBeNull();
  });
  it('renders children on exempt route', () => {
    pathname = '/login';
    render(<OnboardingGate><div>LOGIN</div></OnboardingGate>);
    expect(screen.getByText('LOGIN')).toBeInTheDocument();
  });
  it('renders children when session + onboarded', async () => {
    localStorage.setItem('plately.session', JSON.stringify({ email: null, signedInAt: '2026-01-01T00:00:00Z' }));
    localStorage.setItem('plately.prefs', JSON.stringify({ profile: 'muslim', tier: 'custom', restrictions: {}, onboarded: true }));
    render(<OnboardingGate><div>APP</div></OnboardingGate>);
    await vi.waitFor(() => expect(screen.getByText('APP')).toBeInTheDocument());
    expect(replace).not.toHaveBeenCalled();
  });
  it('session but not onboarded, no profile → /onboarding/profile', async () => {
    localStorage.setItem('plately.session', JSON.stringify({ email: null, signedInAt: '2026-01-01T00:00:00Z' }));
    render(<OnboardingGate><div>APP</div></OnboardingGate>);
    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith('/onboarding/profile'));
  });
});
```

- [ ] **Step 4: Run** `npm test -- OnboardingGate` — 4 passed. (`vi.waitFor` is available in Vitest 3.)

- [ ] **Step 5: Commit**

```bash
cd /Users/takyerin/claude && git add plately/plately-web/components/onboarding && git commit -m "feat(plately): onboarding gate + splash"
```

---

### Task 9: Wire the gate, delete `/start`

**Files:** Modify `app/[locale]/layout.tsx`, delete `app/[locale]/start/`, modify `components/chrome/BottomTabs.tsx`

- [ ] **Step 1: In `app/[locale]/layout.tsx`**, wrap the children inside `<NextIntlClientProvider>`:

```tsx
import { OnboardingGate } from '@/components/onboarding/OnboardingGate';
// ...
<NextIntlClientProvider>
  <OnboardingGate>{children}</OnboardingGate>
</NextIntlClientProvider>
```

- [ ] **Step 2: Delete the old onboarding route**

```bash
rm -rf app/[locale]/start
```

- [ ] **Step 3: `components/chrome/BottomTabs.tsx`** — the `restart` item points at `/start`. Change it to `/onboarding/profile` and keep the label key. Also `TopBar`/`ModeSwitch` brand link stays `/explore`.

- [ ] **Step 4: Verify** `npx tsc --noEmit` clean for chrome; `npm run build` — `/[locale]/start` route is gone; build still succeeds (login/onboarding routes don't exist yet → the gate will try to redirect to `/login` which 404s, but build doesn't exercise that). `npm test` green.

- [ ] **Step 5: Commit**

```bash
cd /Users/takyerin/claude && git add -A plately/plately-web/app plately/plately-web/components/chrome && git commit -m "feat(plately): mount onboarding gate, remove /start"
```

---

### Task 10: `/login`

**Files:** Create `app/[locale]/login/page.tsx`, `app/[locale]/login/LoginForm.tsx` (+ css)

- [ ] **Step 1: `LoginForm.tsx`**

```tsx
'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { useSession } from '@/lib/useSession';
import styles from './login.module.css';

export function LoginForm() {
  const t = useTranslations('login');
  const router = useRouter();
  const { signIn } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  function go(as: string | null) {
    signIn(as);
    router.replace('/onboarding/language');
  }

  return (
    <div className={styles.wrap}>
      <h1 className={styles.h}>{t('title')}</h1>
      <p className={styles.sub}>{t('subtitle')}</p>
      <form
        className={styles.form}
        onSubmit={(e) => { e.preventDefault(); go(email.trim() ? email.trim() : null); }}
      >
        <label className={styles.field}>
          <span>{t('emailLabel')}</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </label>
        <label className={styles.field}>
          <span>{t('passwordLabel')}</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </label>
        <button type="submit" className={styles.primary}>{t('signIn')}</button>
      </form>
      <button type="button" className={styles.ghost} onClick={() => go(null)}>{t('guest')}</button>
    </div>
  );
}
```

`login.module.css`:

```css
.wrap { max-inline-size: 380px; margin-inline: auto; padding: var(--space-12) var(--space-6); display: flex; flex-direction: column; gap: var(--space-3); }
.h { font-size: 22px; margin: 0; }
.sub { color: var(--ink-soft); font-size: 13px; margin: 0 0 var(--space-4); }
.form { display: flex; flex-direction: column; gap: var(--space-3); }
.field { display: flex; flex-direction: column; gap: var(--space-1); font-size: 13px; }
.field input { font: inherit; padding: 10px 12px; border-radius: var(--radius-sm); border: 1px solid var(--line); background: var(--paper-raised); color: var(--ink); }
.primary { background: var(--primary); color: var(--primary-contrast); border: 0; border-radius: 999px; padding: 11px; font-weight: 700; cursor: pointer; margin-block-start: var(--space-2); }
.ghost { background: none; border: 1px solid var(--line); border-radius: 999px; padding: 11px; cursor: pointer; color: var(--ink); }
```

- [ ] **Step 2: `app/[locale]/login/page.tsx`**

```tsx
import { setRequestLocale } from 'next-intl/server';
import { LoginForm } from './LoginForm';

export default async function LoginPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <LoginForm />;
}
```

- [ ] **Step 3: Verify** — `npm run build` succeeds, `/[locale]/login` builds for 4 locales. Dev smoke: `curl -s localhost:3000/en/login | grep -o 'Sign in to Plately'`. `npm test` green, `tsc` clean, lint 0.

- [ ] **Step 4: Commit**

```bash
cd /Users/takyerin/claude && git add plately/plately-web/app && git commit -m "feat(plately): demo login screen"
```

---

### Task 11: Onboarding layout + `StepShell` + `/onboarding/language`

**Files:** Create `app/[locale]/onboarding/layout.tsx`, `components/onboarding/StepShell.tsx` (+ css), `app/[locale]/onboarding/language/page.tsx` + `LanguageStep.tsx`

- [ ] **Step 1: `components/onboarding/StepShell.tsx`**

```tsx
import styles from './StepShell.module.css';

export function StepShell({
  title, step, total, children, footer,
}: { title: string; step: number; total: number; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className={styles.wrap}>
      <p className={styles.progress}>{step} / {total}</p>
      <h1 className={styles.h}>{title}</h1>
      <div className={styles.body}>{children}</div>
      {footer && <div className={styles.footer}>{footer}</div>}
    </div>
  );
}
```

`StepShell.module.css`:

```css
.wrap { max-inline-size: 560px; margin-inline: auto; padding: var(--space-8) var(--space-6) var(--space-12); }
.progress { font-size: 12px; color: var(--ink-soft); margin: 0 0 var(--space-2); font-variant-numeric: tabular-nums; }
.h { font-size: 22px; margin: 0 0 var(--space-6); }
.body { display: flex; flex-direction: column; gap: var(--space-4); }
.footer { display: flex; justify-content: space-between; gap: var(--space-3); margin-block-start: var(--space-8); }
```

- [ ] **Step 2: `app/[locale]/onboarding/layout.tsx`**

```tsx
import { setRequestLocale } from 'next-intl/server';

export default async function OnboardingLayout({
  children, params,
}: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <main>{children}</main>;
}
```

- [ ] **Step 3: `app/[locale]/onboarding/language/LanguageStep.tsx`**

```tsx
'use client';
import { useTranslations, useLocale } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { StepShell } from '@/components/onboarding/StepShell';
import { OnboardingCard } from '@/components/explore/OnboardingCard';

const NATIVE: Record<string, string> = { en: 'English', ko: '한국어', ar: 'العربية', hi: 'हिन्दी' };

export function LanguageStep() {
  const t = useTranslations('onboarding');
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  return (
    <StepShell title={t('languageTitle')} step={1} total={3}>
      <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
        {routing.locales.map((l) => (
          <OnboardingCard
            key={l}
            title={NATIVE[l]}
            selected={l === locale}
            onSelect={() => {
              if (l === locale) { router.push('/onboarding/profile'); return; }
              router.replace(pathname, { locale: l });
            }}
          />
        ))}
      </div>
      <button
        className="ob-next"
        onClick={() => router.push('/onboarding/profile')}
        style={{ marginBlockStart: 'var(--space-6)', background: 'var(--primary)', color: 'var(--primary-contrast)', border: 0, borderRadius: 999, padding: '10px 22px', fontWeight: 700, cursor: 'pointer' }}
      >
        {t('next')}
      </button>
    </StepShell>
  );
}
```

> `OnboardingCard` from Task 15 of the v1 plan already exists at `components/explore/OnboardingCard.tsx` — reuse it.

- [ ] **Step 4: `app/[locale]/onboarding/language/page.tsx`**

```tsx
import { setRequestLocale } from 'next-intl/server';
import { LanguageStep } from './LanguageStep';

export default async function LanguagePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <LanguageStep />;
}
```

- [ ] **Step 5: Verify** — build succeeds, `/en/onboarding/language` renders 4 cards. `npm test` green.

- [ ] **Step 6: Commit**

```bash
cd /Users/takyerin/claude && git add plately/plately-web/app plately/plately-web/components/onboarding && git commit -m "feat(plately): onboarding shell + language step"
```

---

### Task 12: `/onboarding/profile`

**Files:** Create `app/[locale]/onboarding/profile/page.tsx` + `ProfileStep.tsx`

- [ ] **Step 1: `ProfileStep.tsx`**

```tsx
'use client';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { usePreferences } from '@/lib/usePreferences';
import { StepShell } from '@/components/onboarding/StepShell';
import { OnboardingCard } from '@/components/explore/OnboardingCard';

export function ProfileStep() {
  const t = useTranslations('onboarding');
  const router = useRouter();
  const { prefs, setProfile } = usePreferences();

  function pick(p: 'muslim' | 'hindu') {
    setProfile(p);
    router.push('/onboarding/details');
  }

  return (
    <StepShell
      title={t('profileTitle')}
      step={2}
      total={3}
      footer={<button onClick={() => router.push('/onboarding/language')} className="ob-back" style={{ background: 'none', border: '1px solid var(--line)', borderRadius: 999, padding: '10px 22px', cursor: 'pointer', color: 'var(--ink)' }}>{t('back')}</button>}
    >
      <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
        <OnboardingCard title={`☪️ ${t('profileMuslim')}`} selected={prefs.profile === 'muslim'} onSelect={() => pick('muslim')} />
        <OnboardingCard title={`🕉️ ${t('profileHindu')}`} selected={prefs.profile === 'hindu'} onSelect={() => pick('hindu')} />
      </div>
    </StepShell>
  );
}
```

- [ ] **Step 2: `app/[locale]/onboarding/profile/page.tsx`**

```tsx
import { setRequestLocale } from 'next-intl/server';
import { ProfileStep } from './ProfileStep';

export default async function ProfilePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ProfileStep />;
}
```

- [ ] **Step 3: Verify** build + `npm test` + `tsc` + lint.

- [ ] **Step 4: Commit**

```bash
cd /Users/takyerin/claude && git add plately/plately-web/app && git commit -m "feat(plately): onboarding profile step"
```

---

### Task 13: `TierSelect` + `RestrictionToggles`

**Files:** Create `components/onboarding/TierSelect.tsx` (+ css), `components/onboarding/RestrictionToggles.tsx` (+ css), `components/onboarding/TierSelect.test.tsx`

- [ ] **Step 1: `TierSelect.tsx`**

```tsx
'use client';
import { useTranslations } from 'next-intl';
import type { ProfileKind } from '@/lib/types';
import { tierList } from '@/lib/tiers';
import styles from './TierSelect.module.css';

export function TierSelect({ profile, value, onChange }: {
  profile: ProfileKind; value: string | null; onChange: (tier: string) => void;
}) {
  const t = useTranslations(`tiers.${profile}`);
  return (
    <div className={styles.list} role="radiogroup">
      {tierList(profile).map((tier) => (
        <button
          key={tier} type="button" role="radio" aria-checked={value === tier}
          className={styles.row} data-on={value === tier} onClick={() => onChange(tier)}
        >
          <span className={styles.dot} aria-hidden />
          {t(tier)}
        </button>
      ))}
    </div>
  );
}
```

`TierSelect.module.css`:

```css
.list { display: flex; flex-direction: column; gap: var(--space-2); }
.row { display: flex; align-items: center; gap: var(--space-2); padding: var(--space-3) var(--space-4); border: 1.5px solid var(--line); border-radius: var(--radius-md); background: var(--paper-raised); cursor: pointer; color: var(--ink); font: inherit; text-align: start; }
.row[data-on="true"] { border-color: var(--primary); }
.dot { inline-size: 14px; block-size: 14px; border-radius: 999px; border: 2px solid var(--line); }
.row[data-on="true"] .dot { border-color: var(--primary); background: var(--primary); }
```

- [ ] **Step 2: `RestrictionToggles.tsx`**

```tsx
'use client';
import { useTranslations } from 'next-intl';
import type { ProfileKind, RestrictionKey } from '@/lib/types';
import { PROFILE_RESTRICTIONS } from '@/lib/tiers';
import styles from './RestrictionToggles.module.css';

export function RestrictionToggles({ profile, values, locked, onToggle }: {
  profile: ProfileKind;
  values: Partial<Record<RestrictionKey, boolean>>;
  locked: boolean;
  onToggle: (key: RestrictionKey) => void;
}) {
  const t = useTranslations('restrictions');
  return (
    <div className={styles.grid} data-locked={locked} aria-disabled={locked}>
      {PROFILE_RESTRICTIONS[profile].map((key) => (
        <button
          key={key} type="button" role="switch" aria-checked={!!values[key]}
          disabled={locked} className={styles.chip} data-on={!!values[key]}
          onClick={() => onToggle(key)}
        >
          {t(key)}
        </button>
      ))}
    </div>
  );
}
```

`RestrictionToggles.module.css`:

```css
.grid { display: flex; flex-wrap: wrap; gap: var(--space-2); }
.grid[data-locked="true"] { opacity: 0.55; }
.chip { border: 1px solid var(--line); background: var(--paper-raised); color: var(--ink-soft); border-radius: 999px; padding: 6px 12px; font-size: 13px; cursor: pointer; }
.chip:disabled { cursor: default; }
.chip[data-on="true"] { border-color: var(--primary); color: var(--primary); background: color-mix(in srgb, var(--primary) 8%, transparent); font-weight: 700; }
```

- [ ] **Step 3: `TierSelect.test.tsx`**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import messages from '@/messages/en.json';
import { TierSelect } from './TierSelect';

describe('TierSelect', () => {
  it('renders the muslim tiers and fires onChange', async () => {
    const onChange = vi.fn();
    render(<NextIntlClientProvider locale="en" messages={messages}><TierSelect profile="muslim" value={null} onChange={onChange} /></NextIntlClientProvider>);
    expect(screen.getByRole('radio', { name: 'Pork & alcohol free' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: 'Halal-certified only' }));
    expect(onChange).toHaveBeenCalledWith('halal-certified');
  });
});
```

- [ ] **Step 4: Run** `npm test -- TierSelect` — 1 passed.

- [ ] **Step 5: Commit**

```bash
cd /Users/takyerin/claude && git add plately/plately-web/components/onboarding && git commit -m "feat(plately): tier select + restriction toggles"
```

---

### Task 14: `/onboarding/details`

**Files:** Create `app/[locale]/onboarding/details/page.tsx` + `DetailsStep.tsx`

- [ ] **Step 1: `DetailsStep.tsx`**

```tsx
'use client';
import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { usePreferences } from '@/lib/usePreferences';
import { StepShell } from '@/components/onboarding/StepShell';
import { TierSelect } from '@/components/onboarding/TierSelect';
import { RestrictionToggles } from '@/components/onboarding/RestrictionToggles';

export function DetailsStep() {
  const t = useTranslations('onboarding');
  const router = useRouter();
  const { prefs, hydrated, setTier, toggleRestriction, completeOnboarding } = usePreferences();

  useEffect(() => {
    if (hydrated && !prefs.profile) router.replace('/onboarding/profile');
  }, [hydrated, prefs.profile, router]);

  if (!hydrated || !prefs.profile) return null;
  const profile = prefs.profile;
  const isMuslim = profile === 'muslim';
  const locked = prefs.tier !== 'custom';

  return (
    <StepShell
      title={isMuslim ? t('detailsTitleMuslim') : t('detailsTitleHindu')}
      step={3}
      total={3}
      footer={
        <>
          <button onClick={() => router.push('/onboarding/profile')} style={{ background: 'none', border: '1px solid var(--line)', borderRadius: 999, padding: '10px 22px', cursor: 'pointer', color: 'var(--ink)' }}>{t('back')}</button>
          <button
            onClick={() => { completeOnboarding(); router.replace('/explore'); }}
            style={{ background: 'var(--primary)', color: 'var(--primary-contrast)', border: 0, borderRadius: 999, padding: '10px 22px', fontWeight: 700, cursor: 'pointer' }}
          >
            {t('done')}
          </button>
        </>
      }
    >
      <section>
        <h2 style={{ fontSize: 15, margin: '0 0 var(--space-2)' }}>{isMuslim ? t('halalPrefTitle') : t('meatPrefTitle')}</h2>
        <TierSelect profile={profile} value={prefs.tier} onChange={setTier} />
      </section>
      <section>
        <h2 style={{ fontSize: 15, margin: '0 0 var(--space-2)' }}>{t('detailedTitle')}</h2>
        {locked && <p style={{ fontSize: 12, color: 'var(--ink-soft)', margin: '0 0 var(--space-2)' }}>{t('customHint')}</p>}
        <RestrictionToggles profile={profile} values={prefs.restrictions} locked={locked} onToggle={toggleRestriction} />
      </section>
    </StepShell>
  );
}
```

- [ ] **Step 2: `app/[locale]/onboarding/details/page.tsx`**

```tsx
import { setRequestLocale } from 'next-intl/server';
import { DetailsStep } from './DetailsStep';

export default async function DetailsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <DetailsStep />;
}
```

- [ ] **Step 3: Verify** — build succeeds. Dev smoke: manually walk `/en/login` → guest → language → profile (Muslim) → details: selecting "Halal-certified only" checks 6 toggles and dims them; "Custom" unlocks. "Start exploring" → `/en/explore`. Reload `/en/explore` → stays (no redirect). `npm test`/`tsc`/lint green.

- [ ] **Step 4: Commit**

```bash
cd /Users/takyerin/claude && git add plately/plately-web/app && git commit -m "feat(plately): onboarding details step (tier + toggles + finish)"
```

---

## Phase C — Explore & detail integration

### Task 15: Generalize `FilterChips` + `ExploreView` base filter

**Files:** Rewrite `components/explore/FilterChips.tsx` (+ css unchanged), modify `app/[locale]/explore/ExploreView.tsx`, create `lib/restaurantTags.ts`

- [ ] **Step 1: `lib/restaurantTags.ts`** — shared helper for card tags (replaces literal logic in `RestaurantCard`):

```ts
import type { RestaurantAttributes } from './types';

export type TagKey = 'tagPorkFree' | 'tagAlcoholFree' | 'tagVeg' | 'tagHalal';

export function restaurantTags(a: RestaurantAttributes): TagKey[] {
  const tags: TagKey[] = [];
  if (!a.containsPork) tags.push('tagPorkFree');
  if (a.servesAlcohol === false) tags.push('tagAlcoholFree');
  if (a.vegetarianFriendly) tags.push('tagVeg');
  if (a.halalCertified) tags.push('tagHalal');
  return tags;
}
```

Add `"tagHalal": "halal-certified"` to `explore` in all 4 message catalogs (parity check after).

- [ ] **Step 2: Rewrite `components/explore/FilterChips.tsx`** to render from a passed list of `RestrictionKey` plus the fixed cuisine/halal chips:

```tsx
'use client';
import { useTranslations } from 'next-intl';
import type { RestrictionKey } from '@/lib/types';
import styles from './FilterChips.module.css';

export type ExtraChip = 'seafoodCuisine' | 'chickenCuisine' | 'koreanCuisine' | 'halalCertified';

export function FilterChips({
  restrictionKeys, activeRestrictions, onToggleRestriction,
  extras, activeExtras, onToggleExtra,
}: {
  restrictionKeys: RestrictionKey[];
  activeRestrictions: Partial<Record<RestrictionKey, boolean>>;
  onToggleRestriction: (k: RestrictionKey) => void;
  extras: ExtraChip[];
  activeExtras: Set<ExtraChip>;
  onToggleExtra: (k: ExtraChip) => void;
}) {
  const tr = useTranslations('restrictions');
  const tf = useTranslations('filters');
  const te = useTranslations('explore');
  return (
    <div className={styles.row} role="group" aria-label={te('filtersLabel')}>
      {restrictionKeys.map((k) => (
        <button key={k} type="button" className={styles.chip} data-on={!!activeRestrictions[k]} aria-pressed={!!activeRestrictions[k]} onClick={() => onToggleRestriction(k)}>
          {tr(k)}
        </button>
      ))}
      {extras.map((k) => (
        <button key={k} type="button" className={styles.chip} data-on={activeExtras.has(k)} aria-pressed={activeExtras.has(k)} onClick={() => onToggleExtra(k)}>
          {k === 'halalCertified' ? tf('halalCertified') : k === 'seafoodCuisine' ? tf('seafood') : k === 'chickenCuisine' ? tf('chicken') : tf('korean')}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Rewrite the `ExploreView.tsx` body** to use the new model:

```tsx
'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Map as MlMap } from 'maplibre-gl';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { BaseMap } from '@/components/map/BaseMap';
import { syncPins } from '@/components/map/restaurantPins';
import { FilterChips, type ExtraChip } from '@/components/explore/FilterChips';
import { RestaurantList } from '@/components/explore/RestaurantList';
import { getRestaurants } from '@/lib/mockData';
import { usePreferences } from '@/lib/usePreferences';
import { filterFromPreferences } from '@/lib/filter';
import { PROFILE_RESTRICTIONS } from '@/lib/tiers';
import type { RestaurantFilter, RestrictionKey } from '@/lib/types';

const EXTRA_CUISINE: Record<Exclude<ExtraChip, 'halalCertified'>, string> = {
  seafoodCuisine: 'seafood', chickenCuisine: 'korean-chicken', koreanCuisine: 'korean',
};

export function ExploreView() {
  const t = useTranslations('explore');
  const router = useRouter();
  const { prefs, hydrated } = usePreferences();
  const [loosened, setLoosened] = useState<Set<RestrictionKey>>(new Set());
  const [extras, setExtras] = useState<Set<ExtraChip>>(new Set());
  const mapRef = useRef<MlMap | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => { setLoosened(new Set()); }, [hydrated, prefs.profile, prefs.tier]);

  const restrictionKeys = prefs.profile ? PROFILE_RESTRICTIONS[prefs.profile] : [];
  const activeRestrictions = useMemo(() => {
    const base = filterFromPreferences(prefs).restrictions ?? {};
    const out: Partial<Record<RestrictionKey, boolean>> = {};
    for (const [k, on] of Object.entries(base)) out[k as RestrictionKey] = on && !loosened.has(k as RestrictionKey);
    return out;
  }, [prefs, loosened]);

  const filter = useMemo<RestaurantFilter>(() => {
    const fp = filterFromPreferences(prefs);
    const cuisines: string[] = [];
    for (const e of extras) if (e !== 'halalCertified') cuisines.push(EXTRA_CUISINE[e]);
    return {
      ...fp,
      restrictions: activeRestrictions,
      requireHalalCertified: fp.requireHalalCertified || extras.has('halalCertified'),
      cuisines: cuisines.length ? cuisines : undefined,
    };
  }, [prefs, activeRestrictions, extras]);

  const results = useMemo(() => getRestaurants(filter), [filter]);

  useEffect(() => { if (mapRef.current && ready) syncPins(mapRef.current, results); }, [results, ready]);

  return (
    <div className="explore-view">
      {/* keep the existing explore.module.css structure — import styles as before */}
      <FilterChips
        restrictionKeys={restrictionKeys}
        activeRestrictions={activeRestrictions}
        onToggleRestriction={(k) => setLoosened((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; })}
        extras={['seafoodCuisine', 'chickenCuisine', 'koreanCuisine', 'halalCertified']}
        activeExtras={extras}
        onToggleExtra={(k) => setExtras((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; })}
      />
      <p>{t('placeCount', { count: results.length })}</p>
      <RestaurantList items={results} emptyLabel={t('noMatches')} />
      <BaseMap
        label={t('mapLabel')}
        onReady={(m) => {
          mapRef.current = m; setReady(true);
          m.on('click', 'restaurant-dots', (e) => {
            const id = (e.features?.[0]?.properties as { id?: string } | undefined)?.id;
            if (id) router.push(`/explore/${id}`);
          });
        }}
      />
    </div>
  );
}
```

> Keep the actual JSX layout / `styles` from the existing `explore.module.css` (split panel + map). The snippet above shows the wiring — preserve the existing container/`styles.view`/`styles.panel`/`styles.mapSlot` structure and slot these pieces in.

- [ ] **Step 4: Verify** — `npm test` (RestaurantCard test may need the mock updated for 14 attrs — fix it), `tsc`, lint, build. Dev smoke: onboard as Hindu/vegetarian → `/explore` shows fewer results than an unfiltered list; toggling a restriction chip off widens results.

- [ ] **Step 5: Commit**

```bash
cd /Users/takyerin/claude && git add plately/plately-web && git commit -m "feat(plately): explore filters driven by profile restrictions"
```

---

### Task 16: Restaurant detail "Your restrictions" + tag cleanup

**Files:** Create `components/explore/YourRestrictions.tsx` (+ css), modify `app/[locale]/explore/[id]/page.tsx`, modify `components/explore/RestaurantCard.tsx`

- [ ] **Step 1: `components/explore/YourRestrictions.tsx`**

```tsx
'use client';
import { useTranslations } from 'next-intl';
import type { RestaurantAttributes, Preferences, RestrictionKey } from '@/lib/types';
import styles from './YourRestrictions.module.css';

const CHECK: Record<RestrictionKey, (a: RestaurantAttributes) => boolean | 'unknown'> = {
  pork: (a) => a.containsPork === false,
  alcohol: (a) => a.servesAlcohol === false ? true : a.servesAlcohol === 'unknown' ? 'unknown' : false,
  porkDerived: (a) => a.porkDerivedIngredients === false ? true : a.porkDerivedIngredients === 'unknown' ? 'unknown' : false,
  gelatin: (a) => a.containsGelatin === false ? true : a.containsGelatin === 'unknown' ? 'unknown' : false,
  nonHalalMeat: (a) => a.nonHalalMeat === false ? true : a.nonHalalMeat === 'unknown' ? 'unknown' : false,
  seafood: (a) => a.containsSeafood === false,
  crossContamination: (a) => a.crossContaminationRisk === false ? true : a.crossContaminationRisk === 'unknown' ? 'unknown' : false,
  beef: (a) => a.containsBeef === false,
  chicken: (a) => a.containsChicken === false,
  fish: (a) => a.containsFish === false,
  eggs: (a) => a.containsEgg === false,
  onion: (a) => a.containsOnionGarlic === false,
  garlic: (a) => a.containsOnionGarlic === false,
};

export function YourRestrictions({ prefs, attributes }: { prefs: Preferences; attributes: RestaurantAttributes }) {
  const t = useTranslations('restaurant');
  const tr = useTranslations('restrictions');
  const active = Object.entries(prefs.restrictions ?? {}).filter(([, on]) => on).map(([k]) => k as RestrictionKey);
  if (active.length === 0) return null;
  return (
    <section>
      <h2>{t('yourRestrictions')}</h2>
      <ul className={styles.list}>
        {active.map((k) => {
          const v = CHECK[k](attributes);
          return (
            <li key={k} className={styles.row} data-state={v === true ? 'ok' : 'unknown'}>
              <span>{tr(k)}</span>
              <span>{v === true ? t('restrictionClear') : t('restrictionUnknown')}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
```

`YourRestrictions.module.css`:

```css
.list { list-style: none; padding: 0; margin: 0; border: 1px solid var(--line); border-radius: var(--radius-md); overflow: hidden; }
.row { display: flex; justify-content: space-between; padding: var(--space-3) var(--space-4); border-block-end: 1px solid var(--line); font-size: 14px; }
.row:last-child { border-block-end: 0; }
.row[data-state="ok"] { color: var(--primary); }
.row[data-state="unknown"] { color: var(--ink-soft); }
```

- [ ] **Step 2: `app/[locale]/explore/[id]/page.tsx`** — this page is a Server Component; `YourRestrictions` needs `prefs` which is client-only. Render a client wrapper:

Create `app/[locale]/explore/[id]/YourRestrictionsSlot.tsx`:

```tsx
'use client';
import { usePreferences } from '@/lib/usePreferences';
import { YourRestrictions } from '@/components/explore/YourRestrictions';
import type { RestaurantAttributes } from '@/lib/types';

export function YourRestrictionsSlot({ attributes }: { attributes: RestaurantAttributes }) {
  const { prefs, hydrated } = usePreferences();
  if (!hydrated) return null;
  return <YourRestrictions prefs={prefs} attributes={attributes} />;
}
```

In `page.tsx`, add `<YourRestrictionsSlot attributes={r.attributes} />` after the existing attributes section.

- [ ] **Step 3: `components/explore/RestaurantCard.tsx`** — replace the inline tag `<span>` logic with `restaurantTags(r.attributes).map((k) => <span key={k}>{te(k)}</span>)` where `te = useTranslations('explore')`.

- [ ] **Step 4: Verify** build + tests. Update `RestaurantCard.test.tsx` fixture to include the 14 attribute keys (or spread a helper). Dev smoke: onboard as Muslim/halal-certified, open a non-certified venue detail → "Your restrictions" shows the active items with "Looks clear" / "Check with the venue".

- [ ] **Step 5: Commit**

```bash
cd /Users/takyerin/claude && git add plately/plately-web && git commit -m "feat(plately): restaurant-detail 'your restrictions' + shared tag helper"
```

---

## Phase D — e2e & finish

### Task 17: e2e — onboarding flow + smoke update

**Files:** Create `tests/e2e/onboarding.spec.ts`, modify `tests/e2e/smoke.spec.ts`

- [ ] **Step 1: `tests/e2e/onboarding.spec.ts`**

```ts
import { test, expect } from '@playwright/test';

test('unauthenticated visit is gated into login → onboarding → explore', async ({ page }) => {
  await page.goto('/en/explore');
  await expect(page).toHaveURL(/\/en\/login/);

  await page.getByRole('button', { name: 'Continue as guest' }).click();
  await expect(page).toHaveURL(/\/en\/onboarding\/language/);

  await page.getByRole('button', { name: 'English' }).click();
  // may need the Next button if already on the current locale:
  if (!/onboarding\/profile/.test(page.url())) await page.getByRole('button', { name: 'Next' }).click();
  await expect(page).toHaveURL(/\/en\/onboarding\/profile/);

  await page.getByRole('button', { name: /Muslim/ }).click();
  await expect(page).toHaveURL(/\/en\/onboarding\/details/);

  await page.getByRole('radio', { name: 'Halal-certified only' }).click();
  await page.getByRole('button', { name: 'Start exploring' }).click();
  await expect(page).toHaveURL(/\/en\/explore/);
  await expect(page.getByText(/\d+ place/)).toBeVisible();

  await page.reload();
  await expect(page).toHaveURL(/\/en\/explore/);
});

test('ar login is RTL', async ({ page }) => {
  await page.goto('/ar/login');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
});

test('onboarded session goes straight to explore', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('plately.session', JSON.stringify({ email: null, signedInAt: '2026-01-01T00:00:00Z' }));
    localStorage.setItem('plately.prefs', JSON.stringify({ profile: 'hindu', tier: 'vegetarian', restrictions: { beef: true, pork: true, chicken: true, fish: true, seafood: true }, onboarded: true }));
  });
  await page.goto('/en/explore');
  await expect(page).toHaveURL(/\/en\/explore/);
  await expect(page.getByText(/\d+ place/)).toBeVisible();
});
```

- [ ] **Step 2: Update `tests/e2e/smoke.spec.ts`** — (a) remove `/start` from the `paths` array; add `/login`, `/onboarding/language`, `/onboarding/profile`; (b) for the non-gated routes (`/explore`, `/insight*`), prepend an `addInitScript` (via `test.beforeEach`) that seeds an onboarded guest session so the gate lets them through:

```ts
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('plately.session', JSON.stringify({ email: null, signedInAt: '2026-01-01T00:00:00Z' }));
      localStorage.setItem('plately.prefs', JSON.stringify({ profile: 'muslim', tier: 'custom', restrictions: {}, onboarded: true }));
    } catch {}
  });
});
```

Keep the existing `dir=rtl`, filter-chip, region-panel tests but the filter-chip test now targets a restriction chip label (`Pork` etc.) — update its selector: `page.getByRole('button', { name: 'Seafood' })` won't exist for a `custom`/empty profile; instead seed the profile with `restrictions: { seafood: true }` in that test's init script and assert toggling it changes the count.

- [ ] **Step 3: Update `tests/e2e/a11y.spec.ts`** — add `/en/login`, `/en/onboarding/profile`, `/en/onboarding/details` to the route list; add the same `beforeEach` session seed so `/en/explore` etc. render. For `/en/onboarding/details` the seed also needs `profile` set (use `{ profile: 'muslim', tier: 'pork-alcohol-free', restrictions: {...}, onboarded: false }`).

- [ ] **Step 4: Run** `npm run e2e` — all pass. Fix selectors against actual rendered output as needed; report adjustments.

- [ ] **Step 5: Commit**

```bash
cd /Users/takyerin/claude && git add plately/plately-web/tests && git commit -m "test(plately): onboarding e2e + gated smoke/a11y suites"
```

---

### Task 18: README + final verification

**Files:** Modify `plately/plately-web/README.md`

- [ ] **Step 1: Update the README** — under a new "Auth & onboarding" section: the app now gates on a demo session (`localStorage` `plately.session`) + a completed profile (`plately.prefs.onboarded`). Flow: `/login` → `/onboarding/language` → `/onboarding/profile` → `/onboarding/details` → `/explore`. To reset: clear those two localStorage keys (or call `resetOnboarding()`). Document the tier→restriction preset behaviour and that the 14 restaurant attribute fields drive filtering with `'unknown'` passing through. Note `/start` is removed.

- [ ] **Step 2: Full gates**

```bash
npm test          # report count
npm run lint      # 0 errors
npm run lint:css  # green
npx tsc --noEmit  # clean
npm run build     # succeeds — paste route list (should show /login, /onboarding/*, NO /start)
npm run e2e       # all pass
```

- [ ] **Step 3: Commit**

```bash
cd /Users/takyerin/claude && git add plately/plately-web/README.md && git commit -m "docs(plately): document login + onboarding gate"
```

---

## Self-Review

**1. Spec coverage**

| Spec section | Task(s) |
|---|---|
| §2 routes/flow | 10 (login), 11 (language), 12 (profile), 14 (details); §2 "/start 삭제" → Task 9 |
| §3 gate | 8 (OnboardingGate) + 9 (mount) |
| §4 detailed screen + tier→preset | 7 (keys), 13 (TierSelect/RestrictionToggles), 14 (DetailsStep), 2 (`tiers.ts` presets) |
| §5 types (Preferences/Session/attrs/filter) | 1 |
| §5 `tiers.ts` | 2 |
| §5 mock data expansion | 6 |
| §6 filter rework | 5 |
| §7 Explore integration | 15 |
| §7 detail "Your restrictions" | 16 |
| §8 i18n | 7 (+ tag key in 15) |
| §9 tests | per-task unit tests; 17 (e2e) |
| §10 file structure | matches Tasks 1–18 |
| §11 non-scope (logout UI, social, city) | not implemented — correct |

Gap found + fixed: spec §5 says `onion`/`garlic` are separate UI toggles but one data axis — covered in Task 5 (`RULES.onion`/`RULES.garlic` both read `containsOnionGarlic`) and Task 13 (`PROFILE_RESTRICTIONS.hindu` lists both) and Task 16 (`CHECK` maps both). Consistent.

Gap found + fixed: the v1 `ExploreView`/`FilterChips`/`RestaurantCard`/`RestaurantList` and their tests reference the removed `avoidPork` etc. — Task 15 rewrites chips + view, Task 16 fixes the card, and each task's Step 4 calls out updating the affected `.test.tsx` fixtures to the 14-field attribute shape. `RestaurantList`'s `emptyLabel` prop already exists from the v1 polish commit.

**2. Placeholder scan** — no "TBD"/"handle edge cases". Inline-style objects in the onboarding steps are deliberate (small one-off screens) but Task 11/12/14 could be flagged by a reviewer for not using CSS Modules — acceptable for wizard steps; if the reviewer objects, extract to a shared `onboarding-actions.module.css`. Noted, not blocking.

**3. Type consistency** — `Preferences.profile` is `ProfileKind | null` everywhere (Task 1, 4, 8, 14). `RestrictionKey` union identical in Task 1/2/5/13/16. `filterFromPreferences` returns `{ restrictions, requireHalalCertified, requireVegetarian }` in Task 5, consumed with those exact names in Task 15. `usePreferences` returns `{ prefs, hydrated, setProfile, setTier, toggleRestriction, completeOnboarding, resetOnboarding }` in Task 4, used with those names in Tasks 8/12/14. `useSession` returns `{ session, hydrated, signIn, signOut }` in Task 3, used in Tasks 8/10.

---

## Execution Handoff

Plan saved to `plately/docs/superpowers/plans/2026-08-27-plately-auth-onboarding.md`. The user has asked to implement and then push, so proceeding with **Subagent-Driven** execution.
