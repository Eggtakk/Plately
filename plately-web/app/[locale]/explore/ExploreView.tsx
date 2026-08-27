'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Map as MlMap } from 'maplibre-gl';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { BaseMap } from '@/components/map/BaseMap';
import { syncPins } from '@/components/map/restaurantPins';
import { FilterChips, type ExtraChip } from '@/components/explore/FilterChips';
import { ProfileSummary } from '@/components/explore/ProfileSummary';
import { RestaurantList } from '@/components/explore/RestaurantList';
import { getRestaurants } from '@/lib/mockData';
import { usePreferences } from '@/lib/usePreferences';
import { filterFromPreferences } from '@/lib/filter';
import type { RestaurantFilter, RestrictionKey } from '@/lib/types';
import styles from './explore.module.css';

const EXTRA_CUISINE: Record<ExtraChip, string> = {
  seafoodCuisine: 'seafood', chickenCuisine: 'korean-chicken', koreanCuisine: 'korean',
};
const RESTRICTION_FOR_EXTRA: Partial<Record<ExtraChip, RestrictionKey>> = {
  seafoodCuisine: 'seafood', chickenCuisine: 'chicken',
};
const ALL_EXTRAS: ExtraChip[] = ['seafoodCuisine', 'chickenCuisine', 'koreanCuisine'];

export function ExploreView() {
  const t = useTranslations('explore');
  const router = useRouter();
  const { prefs } = usePreferences();
  const [extras, setExtras] = useState<Set<ExtraChip>>(new Set());
  const mapRef = useRef<MlMap | null>(null);
  const [ready, setReady] = useState(false);

  const shownExtras = ALL_EXTRAS.filter((e) => {
    const r = RESTRICTION_FOR_EXTRA[e];
    return !r || !prefs.restrictions?.[r];
  });

  // drop any active extra that is no longer shown when the profile changes
  useEffect(() => {
    setExtras((s) => {
      const next = new Set([...s].filter((e) => {
        const r = RESTRICTION_FOR_EXTRA[e];
        return !r || !prefs.restrictions?.[r];
      }));
      return next.size === s.size ? s : next;
    });
  }, [prefs.profile, prefs.tier, prefs.restrictions]);

  const filter = useMemo<RestaurantFilter>(() => {
    const fp = filterFromPreferences(prefs);
    const cuisines = [...extras].map((e) => EXTRA_CUISINE[e]);
    return { ...fp, cuisines: cuisines.length ? cuisines : undefined };
  }, [prefs, extras]);

  const results = useMemo(() => getRestaurants(filter), [filter]);

  useEffect(() => { if (mapRef.current && ready) syncPins(mapRef.current, results); }, [results, ready]);

  return (
    <div className={styles.view}>
      <div className={styles.panel}>
        <div className={styles.profileRow}><ProfileSummary /></div>
        <FilterChips
          extras={shownExtras}
          activeExtras={extras}
          onToggleExtra={(k) => setExtras((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; })}
        />
        <p className={styles.count}>{t('placeCount', { count: results.length })}</p>
        <RestaurantList items={results} emptyLabel={t('noMatches')} />
      </div>
      <div className={styles.mapSlot}>
        <BaseMap
          label={t('mapLabel')}
          onReady={(m) => {
            mapRef.current = m; setReady(true);
            m.on('click', 'restaurant-dots', (e) => {
              const id = (e.features?.[0]?.properties as { id?: string } | undefined)?.id;
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
