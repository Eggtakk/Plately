'use client';
import { useTranslations } from 'next-intl';
import type { RestaurantAttributes, Preferences, RestrictionKey } from '@/lib/types';
import styles from './YourRestrictions.module.css';

type Verdict = true | 'unknown';

const CHECK: Record<RestrictionKey, (a: RestaurantAttributes) => Verdict> = {
  pork: (a) => a.containsPork === false ? true : 'unknown',
  alcohol: (a) => a.servesAlcohol === false ? true : 'unknown',
  porkDerived: (a) => a.porkDerivedIngredients === false ? true : 'unknown',
  gelatin: (a) => a.containsGelatin === false ? true : 'unknown',
  nonHalalMeat: (a) => a.nonHalalMeat === false ? true : 'unknown',
  seafood: (a) => a.containsSeafood === false ? true : 'unknown',
  crossContamination: (a) => a.crossContaminationRisk === false ? true : 'unknown',
  beef: (a) => a.containsBeef === false ? true : 'unknown',
  chicken: (a) => a.containsChicken === false ? true : 'unknown',
  fish: (a) => a.containsFish === false ? true : 'unknown',
  eggs: (a) => a.containsEgg === false ? true : 'unknown',
  onion: (a) => a.containsOnionGarlic === false ? true : 'unknown',
  garlic: (a) => a.containsOnionGarlic === false ? true : 'unknown',
};

export function YourRestrictions({ prefs, attributes }: { prefs: Preferences; attributes: RestaurantAttributes }) {
  const t = useTranslations('restaurant');
  const tr = useTranslations('restrictions');
  const active = Object.entries(prefs.restrictions ?? {}).filter(([, on]) => on).map(([k]) => k as RestrictionKey);
  if (active.length === 0) return null;
  return (
    <section>
      <h2>{t('yourRestrictions')}</h2>
      <ul className={styles.list}>
        {active.map((k) => {
          const v = CHECK[k](attributes);
          return (
            <li key={k} className={styles.row} data-state={v === true ? 'ok' : 'unknown'}>
              <span>{tr(k)}</span>
              <span>{v === true ? t('restrictionClear') : t('restrictionUnknown')}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
