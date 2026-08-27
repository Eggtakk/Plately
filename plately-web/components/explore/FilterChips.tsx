'use client';
import { useTranslations } from 'next-intl';
import styles from './FilterChips.module.css';

export type ExtraChip = 'seafoodCuisine' | 'chickenCuisine' | 'koreanCuisine';

const LABEL_KEY: Record<ExtraChip, 'seafood' | 'chicken' | 'korean'> = {
  seafoodCuisine: 'seafood', chickenCuisine: 'chicken', koreanCuisine: 'korean',
};

export function FilterChips({ extras, activeExtras, onToggleExtra }: {
  extras: ExtraChip[];
  activeExtras: Set<ExtraChip>;
  onToggleExtra: (k: ExtraChip) => void;
}) {
  const tf = useTranslations('filters');
  const te = useTranslations('explore');
  if (extras.length === 0) return null;
  return (
    <div className={styles.row} role="group" aria-label={te('filtersLabel')}>
      {extras.map((k) => (
        <button key={k} type="button" className={styles.chip} data-on={activeExtras.has(k)} aria-pressed={activeExtras.has(k)} onClick={() => onToggleExtra(k)}>
          {tf(LABEL_KEY[k])}
        </button>
      ))}
    </div>
  );
}
