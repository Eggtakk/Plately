export type Locale = 'en' | 'ko' | 'ar' | 'hi';
export type LocalizedName = { en: string; ko: string; ar?: string; hi?: string };

export type Confidence = 'phone' | 'menu' | 'name';
export type Tristate = boolean | 'unknown';

export interface RestaurantAttributes {
  containsPork: boolean;
  servesAlcohol: Tristate;
  containsBeef: boolean;
  vegetarianFriendly: boolean;
}

export interface Restaurant {
  id: string;
  name: LocalizedName;
  area: LocalizedName;
  sigunguCode: string;
  coords: [number, number]; // [lng, lat]
  cuisine: string;
  attributes: RestaurantAttributes;
  confidence: Confidence;
  matchedTokens: string[];
  repMenu: string[];
  phoneVerifiedOn?: string; // ISO date
}

export interface RegionGap {
  code: string;
  name: LocalizedName;
  gwangyeok: string;
  demandScore: number;   // 0..100
  supplyCount: number;
  gapIndex: number;      // 0..100
  trendVs2019: number;   // percent
}

export interface RegionGapDetail extends RegionGap {
  topCandidateIds: string[];
  processingStatus: 'pipeline' | 'menu-checked' | 'phone-sampled';
}

export interface Preferences {
  profile: 'muslim' | 'hindu' | 'porkfree' | 'custom';
  avoidPork: boolean;
  avoidAlcohol: boolean;
  avoidBeef: boolean;
  vegetarianOnly: boolean;
  city?: string;
}

export interface RestaurantFilter {
  avoidPork?: boolean;
  avoidAlcohol?: boolean;
  avoidBeef?: boolean;
  vegetarianOnly?: boolean;
  cuisines?: string[];
  sigunguCode?: string;
}
