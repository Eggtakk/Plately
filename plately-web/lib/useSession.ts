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
