'use client';
import { useTranslations } from 'next-intl';
import type { ProfileKind } from '@/lib/types';
import { tierList } from '@/lib/tiers';
import styles from './TierSelect.module.css';

export function TierSelect({ profile, value, onChange }: {
  profile: ProfileKind; value: string | null; onChange: (tier: string) => void;
}) {
  const t = useTranslations(`tiers.${profile}`);
  return (
    <div className={styles.list} role="radiogroup">
      {tierList(profile).map((tier) => (
        <button
          key={tier} type="button" role="radio" aria-checked={value === tier}
          className={styles.row} data-on={value === tier} onClick={() => onChange(tier)}
        >
          <span className={styles.dot} aria-hidden />
          {t(tier)}
        </button>
      ))}
    </div>
  );
}
