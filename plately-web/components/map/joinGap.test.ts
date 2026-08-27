import { describe, it, expect } from 'vitest';
import { joinGapIntoGeoJson } from './joinGap';

const geo = { type: 'FeatureCollection', features: [
  { type: 'Feature', properties: { code: '11110', name: 'Jongno-gu' }, geometry: { type: 'Point', coordinates: [0, 0] } },
] } as const;

describe('joinGapIntoGeoJson', () => {
  it('adds gapIndex/demand/supply from the gap rows', () => {
    const out = joinGapIntoGeoJson(geo as never, [
      { code: '11110', name: { en: 'x', ko: 'x' }, gwangyeok: 'Seoul', demandScore: 70, supplyCount: 5, gapIndex: 40, trendVs2019: 3 },
    ]);
    expect(out.features[0].properties.gapIndex).toBe(40);
    expect(out.features[0].properties.demandScore).toBe(70);
  });
  it('defaults gapIndex to 0 when no row matches', () => {
    const out = joinGapIntoGeoJson(geo as never, []);
    expect(out.features[0].properties.gapIndex).toBe(0);
  });
});
