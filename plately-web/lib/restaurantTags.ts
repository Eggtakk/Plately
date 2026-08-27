import type { RestaurantAttributes } from './types';

export type TagKey = 'tagPorkFree' | 'tagAlcoholFree' | 'tagVeg' | 'tagHalal';

export function restaurantTags(a: RestaurantAttributes): TagKey[] {
  const tags: TagKey[] = [];
  if (!a.containsPork) tags.push('tagPorkFree');
  if (a.servesAlcohol === false) tags.push('tagAlcoholFree');
  if (a.vegetarianFriendly) tags.push('tagVeg');
  if (a.halalCertified) tags.push('tagHalal');
  return tags;
}
