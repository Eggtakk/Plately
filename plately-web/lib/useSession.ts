'use client';
import { useCallback, useSyncExternalStore } from 'react';
import type { Session } from './types';
import { createClientStore } from './clientStore';

const KEY = 'plately.session';

export const sessionStore = createClientStore<Session | null>(
  KEY,
  null,
  (raw) => JSON.parse(raw) as Session,
);

export function useSession() {
  const session = useSyncExternalStore(sessionStore.subscribe, sessionStore.get, () => null);
  const hydrated = useSyncExternalStore(sessionStore.subscribe, () => true, () => false);

  const signIn = useCallback((email: string | null) => {
    sessionStore.set({ email, signedInAt: new Date().toISOString() });
  }, []);
  const signOut = useCallback(() => {
    sessionStore.set(null);
  }, []);

  return { session, hydrated, signIn, signOut };
}
