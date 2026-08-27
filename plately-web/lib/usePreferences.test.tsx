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
