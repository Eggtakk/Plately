import { describe, it, expect } from 'vitest';
import { gapColor, gapBucket, GAP_STOPS } from './gapScale';

describe('gapScale', () => {
  it('low gap → green stop', () => expect(gapColor(0)).toBe(GAP_STOPS[0].color));
  it('high gap → clay stop', () => expect(gapColor(100)).toBe(GAP_STOPS[GAP_STOPS.length - 1].color));
  it('clamps out-of-range input', () => {
    expect(gapColor(-20)).toBe(gapColor(0));
    expect(gapColor(999)).toBe(gapColor(100));
  });
  it('bucket labels are stable', () => {
    expect(gapBucket(10)).toBe('low');
    expect(gapBucket(50)).toBe('medium');
    expect(gapBucket(85)).toBe('high');
  });
});
