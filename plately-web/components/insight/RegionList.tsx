'use client';
import { useLocale, useTranslations } from 'next-intl';
import { gapBucket } from '@/lib/gapScale';
import { formatGapIndex } from '@/lib/format';
import type { RegionGap, Locale } from '@/lib/types';
import styles from './RegionList.module.css';

export function RegionList({ regions, onPick, selected }: {
  regions: RegionGap[]; onPick: (code: string) => void; selected?: string;
}) {
  const t = useTranslations('insight');
  const locale = useLocale() as Locale;
  const sorted = [...regions].sort((a, b) => b.gapIndex - a.gapIndex);
  return (
    <ul className={styles.list} aria-label={t('regionListLabel')}>
      {sorted.map((r) => (
        <li key={r.code}>
          <button type="button" className={styles.row} data-selected={r.code === selected} onClick={() => onPick(r.code)}>
            <span>{r.name[locale] ?? r.name.en}</span>
            <span className={`${styles.badge} tnum`} data-bucket={gapBucket(r.gapIndex)}>{formatGapIndex(r.gapIndex, locale)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
