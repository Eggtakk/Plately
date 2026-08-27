import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { ModeSwitch } from './ModeSwitch';
import { LanguagePicker } from './LanguagePicker';
import { ThemeToggle } from './ThemeToggle';
import styles from './TopBar.module.css';

export async function TopBar() {
  const t = await getTranslations('meta');
  return (
    <header className={styles.bar}>
      <Link href="/explore" className={styles.brand}>{t('appName')}</Link>
      <div className={styles.center}><ModeSwitch /></div>
      <div className={styles.actions}>
        <LanguagePicker />
        <ThemeToggle />
      </div>
    </header>
  );
}
