import { notFound } from 'next/navigation';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { getRestaurant } from '@/lib/mockData';
import { AttributeList } from '@/components/explore/AttributeList';
import { YourRestrictionsSlot } from './YourRestrictionsSlot';
import { Callout } from '@/components/ui/Callout';
import { Badge } from '@/components/ui/Badge';
import { DetailMap } from '@/components/map/DetailMap';
import { formatDate } from '@/lib/format';
import type { Locale } from '@/lib/types';
import styles from './detail.module.css';

export default async function DetailPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const r = getRestaurant(id);
  if (!r) notFound();
  const t = await getTranslations('restaurant');
  const tc = await getTranslations('confidence');
  const l = locale as Locale;

  return (
    <div className={styles.view}>
      <article className={styles.panel}>
        <header className={styles.hero}>
          <h1>{r.name[l] ?? r.name.en}</h1>
          <p>{r.area[l] ?? r.area.en} · {r.cuisine}</p>
          <Badge tone={r.confidence}>{tc(r.confidence)}</Badge>
        </header>

        <section>
          <h2>{t('whyListed')}</h2>
          <ul>
            {r.matchedTokens.length > 0 && <li>{t('matchedTokens')}: {r.matchedTokens.join(', ')}</li>}
            {r.confidence !== 'name' && <li>{t('menuChecked')}</li>}
            {r.phoneVerifiedOn && <li>{t('phoneVerified', { date: formatDate(r.phoneVerifiedOn, l) })}</li>}
          </ul>
        </section>

        <section>
          <h2>{t('attributes')}</h2>
          <AttributeList a={r.attributes} />
        </section>

        <YourRestrictionsSlot attributes={r.attributes} />

        {r.repMenu.length > 0 && (
          <section>
            <h2>{t('repMenu')}</h2>
            <p>{r.repMenu.join(' · ')}</p>
          </section>
        )}

        <Callout>{t('disclaimer')}</Callout>
      </article>
      <div className={styles.mapSlot}>
        <DetailMap coords={r.coords} label={r.name[l] ?? r.name.en} />
      </div>
    </div>
  );
}
