'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Map as MlMap } from 'maplibre-gl';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { BaseMap } from '@/components/map/BaseMap';
import { syncPins } from '@/components/map/restaurantPins';
import { FilterChips, type ExtraChip } from '@/components/explore/FilterChips';
import { RestaurantList } from '@/components/explore/RestaurantList';
import { getRestaurants } from '@/lib/mockData';
import { usePreferences } from '@/lib/usePreferences';
import { filterFromPreferences } from '@/lib/filter';
import { PROFILE_RESTRICTIONS } from '@/lib/tiers';
import type { RestaurantFilter, RestrictionKey } from '@/lib/types';
import styles from './explore.module.css';

const EXTRA_CUISINE: Record<Exclude<ExtraChip, 'halalCertified'>, string> = {
  seafoodCuisine: 'seafood', chickenCuisine: 'korean-chicken', koreanCuisine: 'korean',
};

export function ExploreView() {
  const t = useTranslations('explore');
  const router = useRouter();
  const { prefs } = usePreferences();
  const [loosened, setLoosened] = useState<Set<RestrictionKey>>(new Set());
  const [extras, setExtras] = useState<Set<ExtraChip>>(new Set());
  const mapRef = useRef<MlMap | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => { setLoosened(new Set()); }, [prefs.profile, prefs.tier]);

  const restrictionKeys = prefs.profile ? PROFILE_RESTRICTIONS[prefs.profile] : [];

  const activeRestrictions = useMemo(() => {
    const base = filterFromPreferences(prefs).restrictions ?? {};
    const out: Partial<Record<RestrictionKey, boolean>> = {};
    for (const [k, on] of Object.entries(base)) {
      out[k as RestrictionKey] = !!on && !loosened.has(k as RestrictionKey);
    }
    return out;
  }, [prefs, loosened]);

  const filter = useMemo<RestaurantFilter>(() => {
    const fp = filterFromPreferences(prefs);
    const cuisines: string[] = [];
    for (const e of extras) if (e !== 'halalCertified') cuisines.push(EXTRA_CUISINE[e]);
    return {
      restrictions: activeRestrictions,
      requireHalalCertified: fp.requireHalalCertified || extras.has('halalCertified'),
      requireVegetarian: fp.requireVegetarian,
      cuisines: cuisines.length ? cuisines : undefined,
    };
  }, [prefs, activeRestrictions, extras]);

  const results = useMemo(() => getRestaurants(filter), [filter]);

  useEffect(() => { if (mapRef.current && ready) syncPins(mapRef.current, results); }, [results, ready]);

  return (
    <div className={styles.view}>
      <div className={styles.panel}>
        <FilterChips
          restrictionKeys={restrictionKeys}
          activeRestrictions={activeRestrictions}
          onToggleRestriction={(k) => setLoosened((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; })}
          extras={['seafoodCuisine', 'chickenCuisine', 'koreanCuisine', 'halalCertified']}
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
