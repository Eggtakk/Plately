import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { RESTAURANTS, getRestaurant, getRestaurants, getRegions, getComparisonRegions } from './mockData';

describe('mockData (pipeline sample)', () => {
  it('has restaurants', () => expect(RESTAURANTS.length).toBeGreaterThan(0));
  it('every restaurant has en + ko names', () => {
    for (const r of RESTAURANTS) { expect(r.name.en).toBeTruthy(); expect(r.name.ko).toBeTruthy(); }
  });
  it('every restaurant id is unique', () => {
    expect(new Set(RESTAURANTS.map((r) => r.id)).size).toBe(RESTAURANTS.length);
  });
  it('no restaurant is confirmed pork (pipeline excludes them)', () => {
    for (const r of RESTAURANTS) expect(r.attributes.containsPork).toBe(false);
  });
  it('every restaurant sigunguCode exists in the geojson', () => {
    const geo = JSON.parse(readFileSync('public/sigungu.simplified.geojson', 'utf8')) as {
      features: { properties: { code: string } }[];
    };
    const codes = new Set(geo.features.map((f) => f.properties.code));
    for (const r of RESTAURANTS) expect(codes.has(r.sigunguCode)).toBe(true);
  });
  it('every restaurant has all 14 attribute keys', () => {
    const keys = ['containsPork','servesAlcohol','containsBeef','vegetarianFriendly','containsChicken','containsFish','containsSeafood','containsEgg','containsOnionGarlic','porkDerivedIngredients','containsGelatin','nonHalalMeat','halalCertified','crossContaminationRisk'];
    for (const r of RESTAURANTS) for (const k of keys) expect(r.attributes).toHaveProperty(k);
  });
  it('every restaurant confidence is name|menu|phone', () => {
    for (const r of RESTAURANTS) expect(['name', 'menu', 'phone']).toContain(r.confidence);
  });
  it('getRestaurant returns by id', () => {
    expect(getRestaurant(RESTAURANTS[0].id)?.id).toBe(RESTAURANTS[0].id);
  });
  it('getRestaurants applies a cuisine filter', () => {
    const all = getRestaurants();
    const cuisine = all[0].cuisine;
    expect(getRestaurants({ cuisines: [cuisine] }).every((r) => r.cuisine === cuisine)).toBe(true);
  });
  it('getComparisonRegions returns three distinct regions', () => {
    const [a, b, c] = getComparisonRegions();
    expect(new Set([a.code, b.code, c.code]).size).toBe(3);
  });
  it('has ~250 regions', () => {
    const n = getRegions().length;
    expect(n).toBeGreaterThanOrEqual(220);
    expect(n).toBeLessThanOrEqual(260);
  });
  it('gap index is within 0..100', () => {
    for (const r of getRegions()) { expect(r.gapIndex).toBeGreaterThanOrEqual(0); expect(r.gapIndex).toBeLessThanOrEqual(100); }
  });
});
