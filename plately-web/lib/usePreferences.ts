'use client';
import { useCallback, useSyncExternalStore } from 'react';
import type { Preferences, ProfileKind, RestrictionKey } from './types';
import { presetFor, DEFAULT_TIER } from './tiers';
import { createClientStore } from './clientStore';

const KEY = 'plately.prefs';

export const DEFAULT_PREFERENCES: Preferences = {
  profile: null,
  tier: null,
  restrictions: {},
  onboarded: false,
};

export const prefsStore = createClientStore<Preferences>(
  KEY,
  DEFAULT_PREFERENCES,
  (raw) => ({ ...DEFAULT_PREFERENCES, ...JSON.parse(raw) }),
);

export function usePreferences() {
  const prefs = useSyncExternalStore(prefsStore.subscribe, prefsStore.get, () => DEFAULT_PREFERENCES);
  const hydrated = useSyncExternalStore(prefsStore.subscribe, () => true, () => false);

  const setProfile = useCallback((profile: ProfileKind) => {
    const tier = DEFAULT_TIER[profile];
    prefsStore.set({ ...prefsStore.get(), profile, tier, restrictions: { ...presetFor(profile, tier) } });
  }, []);

  const setTier = useCallback((tier: string) => {
    const cur = prefsStore.get();
    if (!cur.profile) return;
    const restrictions = tier === 'custom' ? cur.restrictions : { ...presetFor(cur.profile, tier) };
    prefsStore.set({ ...cur, tier, restrictions });
  }, []);

  const toggleRestriction = useCallback((key: RestrictionKey) => {
    const cur = prefsStore.get();
    prefsStore.set({ ...cur, restrictions: { ...cur.restrictions, [key]: !cur.restrictions[key] } });
  }, []);

  const completeOnboarding = useCallback(() => {
    prefsStore.set({ ...prefsStore.get(), onboarded: true });
  }, []);

  const resetOnboarding = useCallback(() => {
    prefsStore.set({ ...DEFAULT_PREFERENCES });
  }, []);

  return { prefs, hydrated, setProfile, setTier, toggleRestriction, completeOnboarding, resetOnboarding };
}
