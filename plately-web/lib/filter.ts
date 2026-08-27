import type { Restaurant, RestaurantFilter, Preferences, RestrictionKey, RestaurantAttributes } from './types';

type Rule = (a: RestaurantAttributes) => boolean; // true = conflict → exclude

const RULES: Record<RestrictionKey, Rule> = {
  pork: (a) => a.containsPork === true,
  alcohol: (a) => a.servesAlcohol === true,
  porkDerived: (a) => a.porkDerivedIngredients === true,
  gelatin: (a) => a.containsGelatin === true,
  nonHalalMeat: (a) => a.nonHalalMeat === true,
  seafood: (a) => a.containsSeafood === true,
  crossContamination: (a) => a.crossContaminationRisk === true,
  beef: (a) => a.containsBeef === true,
  chicken: (a) => a.containsChicken === true,
  fish: (a) => a.containsFish === true,
  eggs: (a) => a.containsEgg === true,
  onion: (a) => a.containsOnionGarlic === true,
  garlic: (a) => a.containsOnionGarlic === true,
};

export function applyRestaurantFilter(list: Restaurant[], f: RestaurantFilter): Restaurant[] {
  const active = Object.entries(f.restrictions ?? {})
    .filter(([, on]) => on)
    .map(([k]) => k as RestrictionKey);
  return list.filter((r) => {
    const a = r.attributes;
    if (f.requireHalalCertified && a.halalCertified !== true) return false;
    if (f.requireVegetarian && a.vegetarianFriendly !== true) return false;
    for (const key of active) if (RULES[key](a)) return false;
    if (f.cuisines && f.cuisines.length > 0 && !f.cuisines.includes(r.cuisine)) return false;
    if (f.sigunguCode && r.sigunguCode !== f.sigunguCode) return false;
    return true;
  });
}

export function filterFromPreferences(p: Preferences): RestaurantFilter {
  return {
    restrictions: p.restrictions ?? {},
    requireHalalCertified: p.profile === 'muslim' && p.tier === 'halal-certified',
    requireVegetarian: p.profile === 'hindu' && p.tier === 'vegetarian',
  };
}
