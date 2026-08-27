'use client';
import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { usePreferences } from '@/lib/usePreferences';
import { StepShell } from '@/components/onboarding/StepShell';
import { TierSelect } from '@/components/onboarding/TierSelect';
import { RestrictionToggles } from '@/components/onboarding/RestrictionToggles';
import styles from './details.module.css';

export function DetailsStep() {
  const t = useTranslations('onboarding');
  const router = useRouter();
  const { prefs, hydrated, setTier, toggleRestriction, completeOnboarding } = usePreferences();

  useEffect(() => {
    if (hydrated && !prefs.profile) router.replace('/onboarding/profile');
  }, [hydrated, prefs.profile, router]);

  if (!hydrated || !prefs.profile) return null;
  const profile = prefs.profile;
  const isMuslim = profile === 'muslim';
  const locked = prefs.tier !== 'custom';

  return (
    <StepShell
      title={isMuslim ? t('detailsTitleMuslim') : t('detailsTitleHindu')}
      step={3}
      total={3}
      footer={
        <>
          <button className={styles.back} onClick={() => router.push('/onboarding/profile')}>{t('back')}</button>
          <button className={styles.done} onClick={() => { completeOnboarding(); router.replace('/explore'); }}>{t('done')}</button>
        </>
      }
    >
      <section>
        <h2 className={styles.subhead}>{isMuslim ? t('halalPrefTitle') : t('meatPrefTitle')}</h2>
        <TierSelect profile={profile} value={prefs.tier} onChange={setTier} />
      </section>
      <section>
        <h2 className={styles.subhead}>{t('detailedTitle')}</h2>
        {locked && <p className={styles.hint}>{t('customHint')}</p>}
        <RestrictionToggles profile={profile} values={prefs.restrictions} locked={locked} onToggle={toggleRestriction} />
      </section>
    </StepShell>
  );
}
