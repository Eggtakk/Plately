'use client';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { usePreferences } from '@/lib/usePreferences';
import type { ProfileKind } from '@/lib/types';
import styles from './ProfileSummary.module.css';

const ICON: Record<ProfileKind, string> = { muslim: '☪️', hindu: '🕉️' };

function TierName({ profile, tier }: { profile: ProfileKind; tier: string }) {
  const t = useTranslations(`tiers.${profile}`);
  return <>{t(tier)}</>;
}

export function ProfileSummary() {
  const te = useTranslations('explore');
  const { prefs, hydrated } = usePreferences();
  if (!hydrated || !prefs.profile || !prefs.tier) return null;
  return (
    <Link href="/onboarding/details" className={styles.pill}>
      <span aria-hidden>{ICON[prefs.profile]}</span>
      <span className={styles.label}>{te('myProfile')}: <TierName profile={prefs.profile} tier={prefs.tier} /></span>
      <span aria-hidden className={styles.chevron}>›</span>
    </Link>
  );
}
