import { describe, it, expect } from 'vitest';
import { restaurantTags } from './restaurantTags';
import type { RestaurantAttributes } from './types';

const A: RestaurantAttributes = {
  containsPork: false, servesAlcohol: false, containsBeef: false, vegetarianFriendly: false,
  containsChicken: false, containsFish: false, containsSeafood: false, containsEgg: false,
  containsOnionGarlic: false, porkDerivedIngredients: false, containsGelatin: false,
  nonHalalMeat: false, halalCertified: false, crossContaminationRisk: false,
};

describe('restaurantTags', () => {
  it('pork-free + alcohol-free when both clear', () => {
    expect(restaurantTags(A)).toEqual(['tagPorkFree', 'tagAlcoholFree']);
  });
  it('adds veg + halal', () => {
    expect(restaurantTags({ ...A, vegetarianFriendly: true, halalCertified: true })).toEqual(['tagPorkFree', 'tagAlcoholFree', 'tagVeg', 'tagHalal']);
  });
  it('no alcohol-free tag when servesAlcohol is unknown', () => {
    expect(restaurantTags({ ...A, servesAlcohol: 'unknown' })).toEqual(['tagPorkFree']);
  });
});
