import styles from './OnboardingSplash.module.css';

export function OnboardingSplash() {
  return (
    <div className={styles.splash} role="status" aria-live="polite">
      <span className={styles.mark}>Plately</span>
    </div>
  );
}
