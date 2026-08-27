'use client';
import { useLocale, useTranslations } from 'next-intl';
import { getRegion, getRestaurant } from '@/lib/mockData';
import { formatCount, formatGapIndex, formatPercent } from '@/lib/format';
import type { Locale } from '@/lib/types';
import styles from './RegionPanel.module.css';

export function RegionPanel({ code, onClose }: { code: string; onClose: () => void }) {
  const t = useTranslations('insight');
  const tc = useTranslations('common');
  const locale = useLocale() as Locale;
  const region = getRegion(code);
  if (!region) return null;
  return (
    <aside className={styles.panel} aria-label={region.name[locale] ?? region.name.en}>
      <div className={styles.head}>
        <h2>{region.name[locale] ?? region.name.en}</h2>
        <button onClick={onClose} aria-label={tc('close')}>{'×'}</button>
      </div>
      <dl className={styles.stats}>
        <div><dt>{t('demand')}</dt><dd className="tnum">{formatCount(region.demandScore, locale)}</dd></div>
        <div><dt>{t('supply')}</dt><dd className="tnum">{formatCount(region.supplyCount, locale)}</dd></div>
        <div><dt>{t('gapIndex')}</dt><dd className="tnum">{formatGapIndex(region.gapIndex, locale)}</dd></div>
        <div><dt>{t('trend')}</dt><dd className="tnum">{formatPercent(region.trendVs2019, locale)}</dd></div>
      </dl>
      <h3>{t('topCandidates')}</h3>
      <ul>
        {region.topCandidateIds.map((id) => {
          const r = getRestaurant(id);
          return r ? <li key={id}>{r.name[locale] ?? r.name.en}</li> : null;
        })}
      </ul>
    </aside>
  );
}
