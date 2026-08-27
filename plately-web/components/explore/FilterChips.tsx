'use client';
import { useTranslations } from 'next-intl';
import styles from './FilterChips.module.css';

export type ChipKey = 'porkFree' | 'alcoholFree' | 'vegetarian' | 'beefFree' | 'seafood' | 'chicken' | 'korean' | 'halalCertified';

export function FilterChips({ active, onToggle }: { active: Set<ChipKey>; onToggle: (k: ChipKey) => void }) {
  const t = useTranslations('filters');
  const keys: ChipKey[] = ['porkFree', 'alcoholFree', 'vegetarian', 'beefFree', 'seafood', 'chicken', 'korean', 'halalCertified'];
  return (
    <div className={styles.row} role="group" aria-label="Filters">
      {keys.map((k) => (
        <button key={k} type="button" className={styles.chip} data-on={active.has(k)} aria-pressed={active.has(k)} onClick={() => onToggle(k)}>
          {t(k)}
        </button>
      ))}
    </div>
  );
}
