import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { RESTAURANTS, getRestaurant, getRegions, getComparisonRegions } from './mockData';

describe('mockData', () => {
  it('has at least 24 restaurants', () => expect(RESTAURANTS.length).toBeGreaterThanOrEqual(24));
  it('every restaurant has en + ko names', () => {
    for (const r of RESTAURANTS) { expect(r.name.en).toBeTruthy(); expect(r.name.ko).toBeTruthy(); }
  });
  it('every restaurant id is unique', () => {
    expect(new Set(RESTAURANTS.map((r) => r.id)).size).toBe(RESTAURANTS.length);
  });
  it('every restaurant sigunguCode exists in the geojson', () => {
    const geo = JSON.parse(
      readFileSync('public/sigungu.simplified.geojson', 'utf8'),
    ) as { features: { properties: { code: string } }[] };
    const codes = new Set(geo.features.map((f) => f.properties.code));
    for (const r of RESTAURANTS) expect(codes.has(r.sigunguCode)).toBe(true);
  });
  it('getRestaurant returns by id', () => {
    expect(getRestaurant(RESTAURANTS[0].id)?.id).toBe(RESTAURANTS[0].id);
  });
  it('getComparisonRegions returns three distinct regions', () => {
    const [a, b, c] = getComparisonRegions();
    expect(new Set([a.code, b.code, c.code]).size).toBe(3);
  });
  it('has ~229 regions', () => {
    const n = getRegions().length;
    expect(n).toBeGreaterThanOrEqual(220);
    expect(n).toBeLessThanOrEqual(260);
  });
  it('gap index is within 0..100', () => {
    for (const r of getRegions()) { expect(r.gapIndex).toBeGreaterThanOrEqual(0); expect(r.gapIndex).toBeLessThanOrEqual(100); }
  });
  it('every restaurant has all 14 attribute keys', () => {
    const keys = ['containsPork','servesAlcohol','containsBeef','vegetarianFriendly','containsChicken','containsFish','containsSeafood','containsEgg','containsOnionGarlic','porkDerivedIngredients','containsGelatin','nonHalalMeat','halalCertified','crossContaminationRisk'];
    for (const r of RESTAURANTS) for (const k of keys) expect(r.attributes).toHaveProperty(k);
  });
  it('at least one halal-certified venue exists', () => {
    expect(RESTAURANTS.some((r) => r.attributes.halalCertified)).toBe(true);
  });
  it('at least one vegetarianFriendly venue exists', () => {
    expect(RESTAURANTS.some((r) => r.attributes.vegetarianFriendly)).toBe(true);
  });
});
