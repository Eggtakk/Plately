'use client';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Badge } from '@/components/ui/Badge';
import type { Restaurant, Locale } from '@/lib/types';
import { restaurantTags } from '@/lib/restaurantTags';
import styles from './RestaurantCard.module.css';

export function RestaurantCard({ r }: { r: Restaurant }) {
  const locale = useLocale() as Locale;
  const t = useTranslations('confidence');
  const te = useTranslations('explore');
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
        {restaurantTags(r.attributes).map((k) => <span key={k} className={styles.tag}>{te(k)}</span>)}
      </div>
    </Link>
  );
}
