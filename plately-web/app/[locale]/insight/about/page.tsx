import { setRequestLocale, getTranslations } from 'next-intl/server';
import styles from './about.module.css';

export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('about');
  const steps = t.raw('pipelineSteps') as string[];

  return (
    <article className={styles.wrap}>
      <h1>{t('title')}</h1>

      <h2>{t('sourcesTitle')}</h2>
      <ul>
        <li>{t('source_localdata')}</li>
        <li>{t('source_tourapi')}</li>
        <li>{t('source_datalab')}</li>
      </ul>

      <h2>{t('pipelineTitle')}</h2>
      <ol className={styles.pipeline}>{steps.map((s, i) => <li key={i}>{s}</li>)}</ol>

      <h2>{t('openDataTitle')}</h2>
      <p>{t('openDataBody')}</p>

      <h2>{t('limitsTitle')}</h2>
      <p>{t('limitsBody')}</p>
    </article>
  );
}
