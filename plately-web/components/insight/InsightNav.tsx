'use client';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import styles from './InsightNav.module.css';

const ITEMS = [
  { href: '/insight', key: 'gapMap' },
  { href: '/insight/rankings', key: 'rankings' },
  { href: '/insight/compare', key: 'compare' },
  { href: '/insight/about', key: 'about' },
] as const;

export function InsightNav() {
  const t = useTranslations('insight');
  const tn = useTranslations('nav');
  const path = usePathname();
  return (
    <nav className={styles.nav} aria-label={tn('insight')}>
      {ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={styles.link}
          data-active={path === item.href}
          aria-current={path === item.href ? 'page' : undefined}
        >
          {t(item.key)}
        </Link>
      ))}
    </nav>
  );
}
