import { describe, it, expect } from 'vitest';
import { applyRestaurantFilter, filterFromPreferences } from './filter';
import type { Restaurant } from './types';

const base = (over: Partial<Restaurant>): Restaurant => ({
  id: 'x', name: { en: 'x', ko: 'x' }, area: { en: 'a', ko: 'a' }, sigunguCode: '11010',
  coords: [127, 37], cuisine: 'korean', confidence: 'name', matchedTokens: [], repMenu: [],
  attributes: { containsPork: false, servesAlcohol: false, containsBeef: false, vegetarianFriendly: false },
  ...over,
});

const pork = base({ id: 'pork', attributes: { containsPork: true, servesAlcohol: false, containsBeef: false, vegetarianFriendly: false } });
const beef = base({ id: 'beef', attributes: { containsPork: false, servesAlcohol: false, containsBeef: true, vegetarianFriendly: false } });
const booze = base({ id: 'booze', attributes: { containsPork: false, servesAlcohol: true, containsBeef: false, vegetarianFriendly: false } });
const boozeUnknown = base({ id: 'booze?', attributes: { containsPork: false, servesAlcohol: 'unknown', containsBeef: false, vegetarianFriendly: false } });
const veg = base({ id: 'veg', attributes: { containsPork: false, servesAlcohol: false, containsBeef: false, vegetarianFriendly: true } });
const list = [pork, beef, booze, boozeUnknown, veg];

describe('applyRestaurantFilter', () => {
  it('no filter returns everything', () => {
    expect(applyRestaurantFilter(list, {}).map((r) => r.id)).toEqual(list.map((r) => r.id));
  });
  it('avoidPork drops pork venues', () => {
    expect(applyRestaurantFilter(list, { avoidPork: true }).some((r) => r.id === 'pork')).toBe(false);
  });
  it('avoidBeef drops beef venues', () => {
    expect(applyRestaurantFilter(list, { avoidBeef: true }).some((r) => r.id === 'beef')).toBe(false);
  });
  it('avoidAlcohol drops confirmed alcohol but KEEPS unknown', () => {
    const out = applyRestaurantFilter(list, { avoidAlcohol: true }).map((r) => r.id);
    expect(out).not.toContain('booze');
    expect(out).toContain('booze?');
  });
  it('vegetarianOnly keeps only vegetarian-friendly', () => {
    expect(applyRestaurantFilter(list, { vegetarianOnly: true }).map((r) => r.id)).toEqual(['veg']);
  });
  it('cuisines filter is an OR match', () => {
    const out = applyRestaurantFilter([base({ id: 'a', cuisine: 'seafood' }), base({ id: 'b', cuisine: 'korean' })], { cuisines: ['seafood'] });
    expect(out.map((r) => r.id)).toEqual(['a']);
  });
});

describe('filterFromPreferences', () => {
  it('muslim profile avoids pork, alcohol optional', () => {
    expect(filterFromPreferences({ profile: 'muslim', avoidPork: true, avoidAlcohol: false, avoidBeef: false, vegetarianOnly: false }))
      .toMatchObject({ avoidPork: true, avoidAlcohol: false });
  });
  it('hindu profile avoids beef', () => {
    expect(filterFromPreferences({ profile: 'hindu', avoidPork: false, avoidAlcohol: false, avoidBeef: true, vegetarianOnly: true }))
      .toMatchObject({ avoidBeef: true, vegetarianOnly: true });
  });
});
