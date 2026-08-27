'use client';
import styles from './Toggle.module.css';

export function Toggle({ checked, onChange, label }: {
  checked: boolean; onChange: (v: boolean) => void; label: string;
}) {
  return (
    <button
      type="button" role="switch" aria-checked={checked}
      className={styles.toggle} data-on={checked}
      onClick={() => onChange(!checked)}
    >
      <span className={styles.knob} aria-hidden />
      <span className={styles.label}>{label}</span>
    </button>
  );
}
