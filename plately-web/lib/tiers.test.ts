import { describe, it, expect } from 'vitest';
import { TIER_PRESETS, PROFILE_RESTRICTIONS, tierList, presetFor } from './tiers';

describe('tiers', () => {
  it('muslim tier list is the 4 halal-preference options', () => {
    expect(tierList('muslim')).toEqual(['halal-certified', 'halal-meat', 'pork-alcohol-free', 'custom']);
  });
  it('hindu tier list is the 5 meat-preference options', () => {
    expect(tierList('hindu')).toEqual(['vegetarian', 'no-beef', 'no-beef-pork', 'no-meat', 'custom']);
  });
  it('pork-alcohol-free presets pork+alcohol+porkDerived', () => {
    expect(presetFor('muslim', 'pork-alcohol-free')).toEqual({ pork: true, alcohol: true, porkDerived: true });
  });
  it('halal-certified presets six restrictions', () => {
    expect(presetFor('muslim', 'halal-certified')).toEqual({
      pork: true, alcohol: true, porkDerived: true, gelatin: true, nonHalalMeat: true, crossContamination: true,
    });
  });
  it('hindu vegetarian presets the five meat/seafood axes', () => {
    expect(presetFor('hindu', 'vegetarian')).toEqual({ beef: true, pork: true, chicken: true, fish: true, seafood: true });
  });
  it('custom preset is empty (user edits)', () => {
    expect(presetFor('muslim', 'custom')).toEqual({});
    expect(presetFor('hindu', 'custom')).toEqual({});
  });
  it('PROFILE_RESTRICTIONS lists the toggles shown per profile', () => {
    expect(PROFILE_RESTRICTIONS.muslim).toEqual(['pork', 'alcohol', 'porkDerived', 'gelatin', 'nonHalalMeat', 'seafood', 'crossContamination']);
    expect(PROFILE_RESTRICTIONS.hindu).toEqual(['beef', 'pork', 'chicken', 'fish', 'seafood', 'eggs', 'onion', 'garlic', 'alcohol', 'crossContamination']);
  });
});
