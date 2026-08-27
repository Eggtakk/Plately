export type Locale = 'en' | 'ko' | 'ar' | 'hi';
export type LocalizedName = { en: string; ko: string; ar?: string; hi?: string };

export type Confidence = 'phone' | 'menu' | 'name';
export type Tristate = boolean | 'unknown';

export interface RestaurantAttributes {
  containsPork: boolean;
  servesAlcohol: Tristate;
  containsBeef: boolean;
  vegetarianFriendly: boolean;
  containsChicken: boolean;
  containsFish: boolean;
  containsSeafood: boolean;
  containsEgg: boolean;
  containsOnionGarlic: boolean;
  porkDerivedIngredients: Tristate;
  containsGelatin: Tristate;
  nonHalalMeat: Tristate;
  halalCertified: boolean;
  crossContaminationRisk: Tristate;
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

export type ProfileKind = 'muslim' | 'hindu';

export type RestrictionKey =
  | 'pork' | 'alcohol' | 'porkDerived' | 'gelatin' | 'nonHalalMeat'
  | 'seafood' | 'crossContamination'
  | 'beef' | 'chicken' | 'fish' | 'eggs' | 'onion' | 'garlic';

export interface Preferences {
  profile: ProfileKind | null;
  tier: string | null;
  restrictions: Partial<Record<RestrictionKey, boolean>>;
  onboarded: boolean;
}

export interface Session {
  email: string | null; // null = guest
  signedInAt: string;   // ISO
}

export interface RestaurantFilter {
  restrictions?: Partial<Record<RestrictionKey, boolean>>;
  requireHalalCertified?: boolean;
  requireVegetarian?: boolean;
  cuisines?: string[];
  sigunguCode?: string;
}
