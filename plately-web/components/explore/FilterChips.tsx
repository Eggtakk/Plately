'use client';
import { useTranslations } from 'next-intl';
import type { RestrictionKey } from '@/lib/types';
import styles from './FilterChips.module.css';

export type ExtraChip = 'seafoodCuisine' | 'chickenCuisine' | 'koreanCuisine' | 'halalCertified';

export function FilterChips({
  restrictionKeys, activeRestrictions, onToggleRestriction,
  extras, activeExtras, onToggleExtra,
}: {
  restrictionKeys: RestrictionKey[];
  activeRestrictions: Partial<Record<RestrictionKey, boolean>>;
  onToggleRestriction: (k: RestrictionKey) => void;
  extras: ExtraChip[];
  activeExtras: Set<ExtraChip>;
  onToggleExtra: (k: ExtraChip) => void;
}) {
  const tr = useTranslations('restrictions');
  const tf = useTranslations('filters');
  const te = useTranslations('explore');
  return (
    <div className={styles.row} role="group" aria-label={te('filtersLabel')}>
      {restrictionKeys.map((k) => (
        <button key={k} type="button" className={styles.chip} data-on={!!activeRestrictions[k]} aria-pressed={!!activeRestrictions[k]} onClick={() => onToggleRestriction(k)}>
          {tr(k)}
        </button>
      ))}
      {extras.map((k) => (
        <button key={k} type="button" className={styles.chip} data-on={activeExtras.has(k)} aria-pressed={activeExtras.has(k)} onClick={() => onToggleExtra(k)}>
          {k === 'halalCertified' ? tf('halalCertified') : k === 'seafoodCuisine' ? tf('seafood') : k === 'chickenCuisine' ? tf('chicken') : tf('korean')}
        </button>
      ))}
    </div>
  );
}
