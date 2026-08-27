'use client';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { usePreferences } from '@/lib/usePreferences';
import { StepShell } from '@/components/onboarding/StepShell';
import { OnboardingCard } from '@/components/explore/OnboardingCard';
import styles from './profile.module.css';

export function ProfileStep() {
  const t = useTranslations('onboarding');
  const router = useRouter();
  const { prefs, setProfile } = usePreferences();

  function pick(p: 'muslim' | 'hindu') {
    setProfile(p);
    router.push('/onboarding/details');
  }

  return (
    <StepShell
      title={t('profileTitle')}
      step={2}
      total={3}
      footer={<button className={styles.back} onClick={() => router.push('/onboarding/language')}>{t('back')}</button>}
    >
      <div className={styles.grid}>
        <OnboardingCard title={`☪️ ${t('profileMuslim')}`} selected={prefs.profile === 'muslim'} onSelect={() => pick('muslim')} />
        <OnboardingCard title={`🕉️ ${t('profileHindu')}`} selected={prefs.profile === 'hindu'} onSelect={() => pick('hindu')} />
      </div>
    </StepShell>
  );
}
