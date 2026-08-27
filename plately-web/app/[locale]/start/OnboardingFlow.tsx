'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { usePreferences } from '@/lib/usePreferences';
import { OnboardingCard } from '@/components/explore/OnboardingCard';
import { Toggle } from '@/components/ui/Toggle';
import styles from './onboarding.module.css';

const CITIES = ['seoul', 'busan', 'incheon', 'jeju'];

export function OnboardingFlow() {
  const t = useTranslations('onboarding');
  const tc = useTranslations('common');
  const router = useRouter();
  const { prefs, update, setProfile } = usePreferences();
  const [step, setStep] = useState<1 | 2>(1);

  return (
    <div className={styles.wrap}>
      {step === 1 && (
        <section aria-labelledby="ob-step1">
          <h1 id="ob-step1" className={styles.h}>{t('step1Title')}</h1>
          <div className={styles.grid}>
            <OnboardingCard title={t('muslim')} description={t('muslimDesc')} selected={prefs.profile === 'muslim'} onSelect={() => setProfile('muslim')} />
            <OnboardingCard title={t('hindu')} description={t('hinduDesc')} selected={prefs.profile === 'hindu'} onSelect={() => setProfile('hindu')} />
            <OnboardingCard title={t('porkfree')} selected={prefs.profile === 'porkfree'} onSelect={() => setProfile('porkfree')} />
            <OnboardingCard title={t('custom')} selected={prefs.profile === 'custom'} onSelect={() => setProfile('custom')} />
          </div>
          <div className={styles.toggles}>
            {prefs.profile === 'muslim' && (
              <Toggle checked={prefs.avoidAlcohol} onChange={(v) => update({ avoidAlcohol: v })} label={t('alcoholToggle')} />
            )}
            {prefs.profile === 'hindu' && (
              <Toggle checked={prefs.vegetarianOnly} onChange={(v) => update({ vegetarianOnly: v })} label={t('vegToggle')} />
            )}
            {prefs.profile === 'custom' && (
              <>
                <Toggle checked={prefs.avoidPork} onChange={(v) => update({ avoidPork: v })} label={t('muslimDesc')} />
                <Toggle checked={prefs.avoidBeef} onChange={(v) => update({ avoidBeef: v })} label={t('hinduDesc')} />
                <Toggle checked={prefs.avoidAlcohol} onChange={(v) => update({ avoidAlcohol: v })} label={t('alcoholToggle')} />
                <Toggle checked={prefs.vegetarianOnly} onChange={(v) => update({ vegetarianOnly: v })} label={t('vegToggle')} />
              </>
            )}
          </div>
          <div className={styles.actions}>
            <button className={styles.ghost} onClick={() => router.push('/explore')}>{t('skip')}</button>
            <button className={styles.primary} onClick={() => setStep(2)}>{t('next')}</button>
          </div>
        </section>
      )}
      {step === 2 && (
        <section aria-labelledby="ob-step2">
          <h1 id="ob-step2" className={styles.h}>{t('step2Title')}</h1>
          <div className={styles.grid}>
            {CITIES.map((c) => (
              <OnboardingCard key={c} title={c} selected={prefs.city === c} onSelect={() => update({ city: c })} />
            ))}
            <OnboardingCard title={t('nearMe')} selected={prefs.city === 'near'} onSelect={() => update({ city: 'near' })} />
          </div>
          <div className={styles.actions}>
            <button className={styles.ghost} onClick={() => setStep(1)}>{tc('back')}</button>
            <button className={styles.primary} onClick={() => router.push('/explore')}>{t('done')}</button>
          </div>
        </section>
      )}
    </div>
  );
}
