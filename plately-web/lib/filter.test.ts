import { describe, it, expect } from 'vitest';
import { applyRestaurantFilter, filterFromPreferences } from './filter';
import type { Restaurant, RestaurantAttributes, Preferences } from './types';

const ATTR: RestaurantAttributes = {
  containsPork: false, servesAlcohol: false, containsBeef: false, vegetarianFriendly: false,
  containsChicken: false, containsFish: false, containsSeafood: false, containsEgg: false,
  containsOnionGarlic: false, porkDerivedIngredients: false, containsGelatin: false,
  nonHalalMeat: false, halalCertified: false, crossContaminationRisk: false,
};
const mk = (id: string, over: Partial<RestaurantAttributes>): Restaurant => ({
  id, name: { en: id, ko: id }, area: { en: 'a', ko: 'a' }, sigunguCode: '11010',
  coords: [127, 37], cuisine: 'korean', confidence: 'name', matchedTokens: [], repMenu: [],
  attributes: { ...ATTR, ...over },
});

describe('applyRestaurantFilter', () => {
  it('empty filter keeps everything', () => {
    const list = [mk('a', {}), mk('b', { containsPork: true })];
    expect(applyRestaurantFilter(list, {}).length).toBe(2);
  });
  it('restriction pork excludes confirmed pork, keeps unknown-free', () => {
    const list = [mk('clean', {}), mk('pork', { containsPork: true })];
    expect(applyRestaurantFilter(list, { restrictions: { pork: true } }).map((r) => r.id)).toEqual(['clean']);
  });
  it('Tristate porkDerived: true excludes, "unknown" passes', () => {
    const list = [mk('yes', { porkDerivedIngredients: true }), mk('maybe', { porkDerivedIngredients: 'unknown' }), mk('no', { porkDerivedIngredients: false })];
    expect(applyRestaurantFilter(list, { restrictions: { porkDerived: true } }).map((r) => r.id)).toEqual(['maybe', 'no']);
  });
  it('onion OR garlic both map to containsOnionGarlic', () => {
    const list = [mk('og', { containsOnionGarlic: true }), mk('plain', {})];
    expect(applyRestaurantFilter(list, { restrictions: { garlic: true } }).map((r) => r.id)).toEqual(['plain']);
    expect(applyRestaurantFilter(list, { restrictions: { onion: true } }).map((r) => r.id)).toEqual(['plain']);
  });
  it('requireHalalCertified keeps only certified', () => {
    const list = [mk('cert', { halalCertified: true }), mk('not', {})];
    expect(applyRestaurantFilter(list, { requireHalalCertified: true }).map((r) => r.id)).toEqual(['cert']);
  });
  it('requireVegetarian keeps only vegetarianFriendly', () => {
    const list = [mk('veg', { vegetarianFriendly: true }), mk('not', {})];
    expect(applyRestaurantFilter(list, { requireVegetarian: true }).map((r) => r.id)).toEqual(['veg']);
  });
  it('cuisines + sigunguCode still work', () => {
    const list = [mk('a', {}), { ...mk('b', {}), cuisine: 'seafood' }];
    expect(applyRestaurantFilter(list, { cuisines: ['seafood'] }).map((r) => r.id)).toEqual(['b']);
  });
});

describe('filterFromPreferences', () => {
  const base: Preferences = { profile: 'muslim', tier: 'pork-alcohol-free', restrictions: { pork: true, alcohol: true }, onboarded: true };
  it('passes restrictions through', () => {
    expect(filterFromPreferences(base).restrictions).toEqual({ pork: true, alcohol: true });
  });
  it('halal-certified tier sets requireHalalCertified', () => {
    expect(filterFromPreferences({ ...base, tier: 'halal-certified' }).requireHalalCertified).toBe(true);
  });
  it('hindu vegetarian tier sets requireVegetarian', () => {
    expect(filterFromPreferences({ profile: 'hindu', tier: 'vegetarian', restrictions: {}, onboarded: true }).requireVegetarian).toBe(true);
  });
  it('null profile → empty filter', () => {
    expect(filterFromPreferences({ profile: null, tier: null, restrictions: {}, onboarded: false })).toEqual({ restrictions: {}, requireHalalCertified: false, requireVegetarian: false });
  });
});
