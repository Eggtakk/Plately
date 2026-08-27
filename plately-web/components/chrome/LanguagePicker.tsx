'use client';
import { useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import styles from './LanguagePicker.module.css';

const NATIVE: Record<string, string> = { en: 'English', ko: '한국어', ar: 'العربية', hi: 'हिन्दी' };

export function LanguagePicker() {
  const t = useTranslations('language');
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <label className={styles.wrap}>
      <span className="sr-only">{t('label')}</span>
      <select
        className={styles.select}
        value={locale}
        disabled={pending}
        onChange={(e) => startTransition(() => router.replace(pathname, { locale: e.target.value }))}
      >
        {routing.locales.map((l) => (
          <option key={l} value={l}>{NATIVE[l]}</option>
        ))}
      </select>
    </label>
  );
}
