import { describe, it, expect } from 'vitest';
import { formatCount, formatGapIndex, formatPercent } from './format';

describe('format', () => {
  it('gap index is always Latin digits regardless of locale', () => {
    expect(formatGapIndex(42, 'ar')).toBe('42');
    expect(formatGapIndex(42, 'hi')).toBe('42');
  });
  it('counts are localized', () => {
    expect(formatCount(1234, 'en')).toBe('1,234');
  });
  it('percent keeps sign', () => {
    expect(formatPercent(-12, 'en')).toBe('-12%');
    expect(formatPercent(8, 'en')).toBe('+8%');
  });
});
