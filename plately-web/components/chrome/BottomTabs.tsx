'use client';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import styles from './BottomTabs.module.css';

export function BottomTabs() {
  const t = useTranslations('nav');
  const path = usePathname();
  const items = [
    { href: '/explore', label: t('explore') },
    { href: '/start', label: t('restart') },
    { href: '/insight/about', label: t('about') },
  ];
  return (
    <nav className={styles.tabs} aria-label="Primary">
      {items.map((i) => (
        <Link key={i.href} href={i.href} className={styles.tab} data-active={path.startsWith(i.href)}>{i.label}</Link>
      ))}
    </nav>
  );
}
