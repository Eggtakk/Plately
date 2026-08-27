'use client';
import { usePreferences } from '@/lib/usePreferences';
import { YourRestrictions } from '@/components/explore/YourRestrictions';
import type { RestaurantAttributes } from '@/lib/types';

export function YourRestrictionsSlot({ attributes }: { attributes: RestaurantAttributes }) {
  const { prefs, hydrated } = usePreferences();
  if (!hydrated) return null;
  return <YourRestrictions prefs={prefs} attributes={attributes} />;
}
