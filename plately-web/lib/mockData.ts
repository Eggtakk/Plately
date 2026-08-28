import type { Restaurant, RegionGap, RegionGapDetail, RestaurantFilter } from './types';
import regionGapJson from '@/public/data/region-gap.json';
import restaurantsJson from '@/public/data/restaurants.json';
import { applyRestaurantFilter } from './filter';

export const RESTAURANTS: Restaurant[] = restaurantsJson as unknown as Restaurant[];

export function getRestaurants(filter: RestaurantFilter = {}): Restaurant[] {
  return applyRestaurantFilter(RESTAURANTS, filter);
}

export function getRestaurant(id: string): Restaurant | undefined {
  return RESTAURANTS.find((r) => r.id === id);
}

export function getRegions(): RegionGap[] {
  return regionGapJson as RegionGap[];
}

export function getRegion(code: string): RegionGapDetail | undefined {
  const base = getRegions().find((r) => r.code === code);
  if (!base) return undefined;
  const topCandidateIds = RESTAURANTS.filter((r) => r.sigunguCode === code).slice(0, 3).map((r) => r.id);
  return { ...base, topCandidateIds, processingStatus: 'menu-checked' };
}

export function getComparisonRegions(): [RegionGap, RegionGap, RegionGap] {
  const byCode = (c: string) => getRegions().find((r) => r.code === c)!;
  return [byCode('11030'), byCode('21040'), byCode('33370')];
}
