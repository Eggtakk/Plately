export type Theme = 'light' | 'dark' | 'system';
const KEY = 'plately.theme';

export function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'system';
  const v = window.localStorage.getItem(KEY);
  return v === 'light' || v === 'dark' ? v : 'system';
}

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
}

export function setTheme(theme: Theme): void {
  if (theme === 'system') window.localStorage.removeItem(KEY);
  else window.localStorage.setItem(KEY, theme);
  applyTheme(theme);
}
