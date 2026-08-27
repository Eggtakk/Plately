import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSession, sessionStore } from './useSession';

beforeEach(() => { localStorage.clear(); sessionStore._reset(); });

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
