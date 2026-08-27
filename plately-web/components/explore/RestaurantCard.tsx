'use client';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Badge } from '@/components/ui/Badge';
import type { Restaurant, Locale } from '@/lib/types';
import styles from './RestaurantCard.module.css';

export function RestaurantCard({ r }: { r: Restaurant }) {
  const locale = useLocale() as Locale;
  const t = useTranslations('confidence');
  const name = r.name[locale] ?? r.name.en;
  const area = r.area[locale] ?? r.area.en;
  return (
    <Link href={`/explore/${r.id}`} className={styles.card}>
      <div className={styles.head}>
        <span className={styles.name}>{name}</span>
        <Badge tone={r.confidence}>{t(r.confidence)}</Badge>
      </div>
      <div className={styles.meta}>{area} · {r.cuisine}</div>
      <div className={styles.tags}>
        {!r.attributes.containsPork && <span className={styles.tag}>pork-free</span>}
        {r.attributes.servesAlcohol === false && <span className={styles.tag}>alcohol-free</span>}
        {r.attributes.vegetarianFriendly && <span className={styles.tag}>veg</span>}
      </div>
    </Link>
  );
}
