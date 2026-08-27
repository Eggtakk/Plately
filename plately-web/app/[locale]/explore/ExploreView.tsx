'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { Map as MlMap } from 'maplibre-gl';
import { useRouter } from '@/i18n/navigation';
import { BaseMap } from '@/components/map/BaseMap';
import { syncPins } from '@/components/map/restaurantPins';
import { FilterChips, type ChipKey } from '@/components/explore/FilterChips';
import { RestaurantList } from '@/components/explore/RestaurantList';
import { getRestaurants } from '@/lib/mockData';
import { usePreferences } from '@/lib/usePreferences';
import type { RestaurantFilter, RestrictionKey } from '@/lib/types';
import styles from './explore.module.css';

const CHIP_TO_RESTRICTIONS: Partial<Record<ChipKey, RestrictionKey[]>> = {
  porkFree: ['pork'],
  alcoholFree: ['alcohol'],
  beefFree: ['beef'],
};
const CHIP_CUISINE: Partial<Record<ChipKey, string>> = {
  seafood: 'seafood',
  chicken: 'korean-chicken',
  korean: 'korean',
  halalCertified: 'halal',
};

export function ExploreView() {
  const t = useTranslations('explore');
  const router = useRouter();
  const { prefs, hydrated } = usePreferences();
  const [chips, setChips] = useState<Set<ChipKey>>(new Set());
  const mapRef = useRef<MlMap | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!hydrated) return;
    const next = new Set<ChipKey>();
    if (prefs.restrictions.pork) next.add('porkFree');
    if (prefs.restrictions.alcohol) next.add('alcoholFree');
    if (prefs.restrictions.beef) next.add('beefFree');
    if (prefs.profile === 'hindu' && prefs.tier === 'vegetarian') next.add('vegetarian');
    setChips(next);
  }, [hydrated, prefs]);

  const filter = useMemo<RestaurantFilter>(() => {
    const restrictions: Partial<Record<RestrictionKey, boolean>> = {};
    const cuisines: string[] = [];
    let requireVegetarian = false;
    for (const c of chips) {
      for (const k of CHIP_TO_RESTRICTIONS[c] ?? []) restrictions[k] = true;
      if (c === 'vegetarian') requireVegetarian = true;
      if (CHIP_CUISINE[c]) cuisines.push(CHIP_CUISINE[c]!);
    }
    const f: RestaurantFilter = { restrictions };
    if (requireVegetarian) f.requireVegetarian = true;
    if (cuisines.length) f.cuisines = cuisines;
    return f;
  }, [chips]);

  const results = useMemo(() => getRestaurants(filter), [filter]);

  useEffect(() => {
    if (!mapRef.current || !ready) return;
    syncPins(mapRef.current, results);
  }, [results, ready]);

  function toggle(k: ChipKey) {
    setChips((prev) => { const n = new Set(prev); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  }

  return (
    <div className={styles.view}>
      <div className={styles.panel}>
        <FilterChips active={chips} onToggle={toggle} />
        <p className={styles.count}>{t('placeCount', { count: results.length })}</p>
        <RestaurantList items={results} emptyLabel={t('noMatches')} />
      </div>
      <div className={styles.mapSlot}>
        <BaseMap
          label={t('mapLabel')}
          onReady={(m) => {
            mapRef.current = m;
            setReady(true);
            m.on('click', 'restaurant-dots', (e) => {
              const id = (e.features?.[0]?.properties as { id?: string })?.id;
              if (id) router.push(`/explore/${id}`);
            });
            m.on('mouseenter', 'restaurant-dots', () => { m.getCanvas().style.cursor = 'pointer'; });
            m.on('mouseleave', 'restaurant-dots', () => { m.getCanvas().style.cursor = ''; });
          }}
        />
      </div>
    </div>
  );
}
