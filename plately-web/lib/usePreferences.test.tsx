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
