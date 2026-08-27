'use client';

type Listener = () => void;

export interface ClientStore<T> {
  get(): T;
  set(next: T): void;
  subscribe(listener: Listener): () => void;
  /** test-only: drop cache + re-read localStorage */
  _reset(): void;
}

export function createClientStore<T>(key: string, fallback: T, parse: (raw: string) => T): ClientStore<T> {
  let cache: T | undefined;
  const listeners = new Set<Listener>();

  function read(): T {
    if (typeof window === 'undefined') return fallback;
    try {
      const raw = window.localStorage.getItem(key);
      return raw == null ? fallback : parse(raw);
    } catch {
      return fallback;
    }
  }

  function get(): T {
    if (cache === undefined) cache = read();
    return cache;
  }

  function emit() {
    for (const l of listeners) l();
  }

  function set(next: T) {
    cache = next;
    try {
      if (next == null) window.localStorage.removeItem(key);
      else window.localStorage.setItem(key, JSON.stringify(next));
    } catch { /* private mode */ }
    emit();
  }

  function subscribe(listener: Listener): () => void {
    if (listeners.size === 0 && typeof window !== 'undefined') {
      window.addEventListener('storage', onStorage);
    }
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0 && typeof window !== 'undefined') {
        window.removeEventListener('storage', onStorage);
      }
    };
  }

  function onStorage(e: StorageEvent) {
    if (e.key === key || e.key === null) {
      cache = read();
      emit();
    }
  }

  function _reset() {
    cache = undefined;
    emit();
  }

  return { get, set, subscribe, _reset };
}
