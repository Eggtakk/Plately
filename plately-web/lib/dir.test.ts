import { describe, it, expect } from 'vitest';
import { dirFor } from '@/i18n/routing';

describe('dirFor', () => {
  it('ar is rtl', () => expect(dirFor('ar')).toBe('rtl'));
  it('en/ko/hi are ltr', () => {
    expect(dirFor('en')).toBe('ltr');
    expect(dirFor('ko')).toBe('ltr');
    expect(dirFor('hi')).toBe('ltr');
  });
});
