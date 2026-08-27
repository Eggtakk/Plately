'use client';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import styles from './ModeSwitch.module.css';

export function ModeSwitch() {
  const t = useTranslations('nav');
  const path = usePathname();
  const mode = path.startsWith('/insight') ? 'insight' : 'explore';
  return (
    <div className={styles.seg} role="tablist" aria-label="Mode">
      <Link href="/explore" className={styles.tab} data-active={mode === 'explore'} role="tab" aria-selected={mode === 'explore'}>{t('explore')}</Link>
      <Link href="/insight" className={styles.tab} data-active={mode === 'insight'} role="tab" aria-selected={mode === 'insight'}>{t('insight')}</Link>
    </div>
  );
}
