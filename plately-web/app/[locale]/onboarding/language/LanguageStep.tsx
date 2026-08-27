'use client';
import { useTranslations, useLocale } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { StepShell } from '@/components/onboarding/StepShell';
import { OnboardingCard } from '@/components/explore/OnboardingCard';
import styles from './language.module.css';

const NATIVE: Record<string, string> = { en: 'English', ko: '한국어', ar: 'العربية', hi: 'हिन्दी' };

export function LanguageStep() {
  const t = useTranslations('onboarding');
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  return (
    <StepShell title={t('languageTitle')} step={1} total={3}>
      <div className={styles.grid}>
        {routing.locales.map((l) => (
          <OnboardingCard
            key={l}
            title={NATIVE[l]}
            selected={l === locale}
            onSelect={() => {
              if (l === locale) { router.push('/onboarding/profile'); return; }
              router.replace(pathname, { locale: l });
            }}
          />
        ))}
      </div>
      <button className={styles.next} onClick={() => router.push('/onboarding/profile')}>{t('next')}</button>
    </StepShell>
  );
}
