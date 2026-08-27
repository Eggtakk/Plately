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
