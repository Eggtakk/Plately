import { describe, it, expect } from 'vitest';
import en from '@/messages/en.json';
import ko from '@/messages/ko.json';
import ar from '@/messages/ar.json';
import hi from '@/messages/hi.json';

function keys(obj: unknown, prefix = ''): string[] {
  if (obj && typeof obj === 'object') {
    return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
      keys(v, prefix ? `${prefix}.${k}` : k),
    );
  }
  return [prefix];
}

describe('message catalogs', () => {
  const base = keys(en).sort();
  it.each([['ko', ko], ['ar', ar], ['hi', hi]] as const)('%s has the same keys as en', (_name, cat) => {
    expect(keys(cat).sort()).toEqual(base);
  });
});
