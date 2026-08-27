import { setRequestLocale, getTranslations } from 'next-intl/server';
import { getComparisonRegions } from '@/lib/mockData';
import { CompareColumn } from '@/components/insight/CompareColumn';
import type { Locale } from '@/lib/types';
import styles from './compare.module.css';

export default async function ComparePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('insight');
  const [seoul, busan, gap] = getComparisonRegions();
  const l = locale as Locale;

  return (
    <div className={styles.wrap}>
      <p className={styles.intro}>{t('compareIntro')}</p>
      <div className={styles.grid}>
        <CompareColumn region={seoul} kind="saturated" prescription={t('rxSaturated')} locale={l} />
        <CompareColumn region={busan} kind="growing" prescription={t('rxGrowing')} locale={l} />
        <CompareColumn region={gap} kind="empty" prescription={t('rxEmpty')} locale={l} />
      </div>
    </div>
  );
}
