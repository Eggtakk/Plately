'use client';
import styles from './OnboardingCard.module.css';

export function OnboardingCard({
  title, description, selected, onSelect,
}: { title: string; description?: string; selected: boolean; onSelect: () => void }) {
  return (
    <button type="button" className={styles.card} data-selected={selected} aria-pressed={selected} onClick={onSelect}>
      <span className={styles.title}>{title}</span>
      {description && <span className={styles.desc}>{description}</span>}
    </button>
  );
}
