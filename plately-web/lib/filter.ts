import type { Restaurant, RestaurantFilter, Preferences } from './types';

export function applyRestaurantFilter(list: Restaurant[], f: RestaurantFilter): Restaurant[] {
  return list.filter((r) => {
    const a = r.attributes;
    if (f.avoidPork && a.containsPork) return false;
    if (f.avoidBeef && a.containsBeef) return false;
    if (f.avoidAlcohol && a.servesAlcohol === true) return false; // 'unknown' is kept, surfaced in UI
    if (f.vegetarianOnly && !a.vegetarianFriendly) return false;
    if (f.cuisines && f.cuisines.length > 0 && !f.cuisines.includes(r.cuisine)) return false;
    if (f.sigunguCode && r.sigunguCode !== f.sigunguCode) return false;
    return true;
  });
}

export function filterFromPreferences(p: Preferences): RestaurantFilter {
  return {
    avoidPork: p.avoidPork,
    avoidAlcohol: p.avoidAlcohol,
    avoidBeef: p.avoidBeef,
    vegetarianOnly: p.vegetarianOnly,
    sigunguCode: undefined,
  };
}
