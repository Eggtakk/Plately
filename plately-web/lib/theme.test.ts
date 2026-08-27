import { describe, it, expect, beforeEach } from 'vitest';
import { getStoredTheme, setTheme, applyTheme } from './theme';

beforeEach(() => { localStorage.clear(); document.documentElement.removeAttribute('data-theme'); });

describe('theme', () => {
  it('defaults to system', () => { expect(getStoredTheme()).toBe('system'); });
  it('persists an explicit theme', () => { setTheme('dark'); expect(getStoredTheme()).toBe('dark'); });
  it('applies data-theme attribute', () => {
    applyTheme('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });
  it('system removes the attribute', () => {
    applyTheme('dark'); applyTheme('system');
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });
});
