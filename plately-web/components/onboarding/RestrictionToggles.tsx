'use client';
import { useTranslations } from 'next-intl';
import type { ProfileKind, RestrictionKey } from '@/lib/types';
import { PROFILE_RESTRICTIONS } from '@/lib/tiers';
import styles from './RestrictionToggles.module.css';

export function RestrictionToggles({ profile, values, locked, onToggle }: {
  profile: ProfileKind;
  values: Partial<Record<RestrictionKey, boolean>>;
  locked: boolean;
  onToggle: (key: RestrictionKey) => void;
}) {
  const t = useTranslations('restrictions');
  return (
    <div className={styles.grid} data-locked={locked} aria-disabled={locked}>
      {PROFILE_RESTRICTIONS[profile].map((key) => (
        <button
          key={key} type="button" role="switch" aria-checked={!!values[key]}
          disabled={locked} className={styles.chip} data-on={!!values[key]}
          onClick={() => onToggle(key)}
        >
          {t(key)}
        </button>
      ))}
    </div>
  );
}
