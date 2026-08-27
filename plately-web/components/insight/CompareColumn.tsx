import { getTranslations } from 'next-intl/server';
import { formatCount, formatGapIndex, formatPercent } from '@/lib/format';
import type { RegionGap, Locale } from '@/lib/types';
import styles from './CompareColumn.module.css';

export async function CompareColumn({
  region, kind, prescription, locale,
}: {
  region: RegionGap; kind: 'saturated' | 'growing' | 'empty';
  prescription: string; locale: Locale;
}) {
  const t = await getTranslations('insight');
  return (
    <section className={styles.col} data-kind={kind}>
      <span className={styles.tag}>{t(kind)}</span>
      <h2>{region.name[locale] ?? region.name.en}</h2>
      <dl className={styles.stats}>
        <div><dt>{t('demand')}</dt><dd className="tnum">{formatCount(region.demandScore, locale)}</dd></div>
        <div><dt>{t('supply')}</dt><dd className="tnum">{formatCount(region.supplyCount, locale)}</dd></div>
        <div><dt>{t('gapIndex')}</dt><dd className="tnum">{formatGapIndex(region.gapIndex, locale)}</dd></div>
        <div><dt>{t('trend')}</dt><dd className="tnum">{formatPercent(region.trendVs2019, locale)}</dd></div>
      </dl>
      <div className={styles.bar} aria-hidden>
        <span style={{ inlineSize: `${Math.min(100, region.demandScore)}%` }} data-role="demand" />
        <span style={{ inlineSize: `${Math.min(100, region.supplyCount * 5)}%` }} data-role="supply" />
      </div>
      <p className={styles.rx}><strong>{t('prescription')}:</strong> {prescription}</p>
    </section>
  );
}
