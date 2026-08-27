import type { ProfileKind, RestrictionKey } from './types';

export const PROFILE_RESTRICTIONS: Record<ProfileKind, RestrictionKey[]> = {
  muslim: ['pork', 'alcohol', 'porkDerived', 'gelatin', 'nonHalalMeat', 'seafood', 'crossContamination'],
  hindu: ['beef', 'pork', 'chicken', 'fish', 'seafood', 'eggs', 'onion', 'garlic', 'alcohol', 'crossContamination'],
};

type Preset = Partial<Record<RestrictionKey, boolean>>;

export const TIER_PRESETS: Record<ProfileKind, Record<string, Preset>> = {
  muslim: {
    'halal-certified': { pork: true, alcohol: true, porkDerived: true, gelatin: true, nonHalalMeat: true, crossContamination: true },
    'halal-meat': { pork: true, porkDerived: true, nonHalalMeat: true },
    'pork-alcohol-free': { pork: true, alcohol: true, porkDerived: true },
    custom: {},
  },
  hindu: {
    vegetarian: { beef: true, pork: true, chicken: true, fish: true, seafood: true },
    'no-beef': { beef: true },
    'no-beef-pork': { beef: true, pork: true },
    'no-meat': { beef: true, pork: true, chicken: true, fish: true, seafood: true },
    custom: {},
  },
};

export function tierList(profile: ProfileKind): string[] {
  return Object.keys(TIER_PRESETS[profile]);
}

export function presetFor(profile: ProfileKind, tier: string): Preset {
  return TIER_PRESETS[profile][tier] ?? {};
}

export const DEFAULT_TIER: Record<ProfileKind, string> = {
  muslim: 'pork-alcohol-free',
  hindu: 'no-beef-pork',
};
