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
