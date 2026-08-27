import styles from './StepShell.module.css';

export function StepShell({
  title, step, total, children, footer,
}: { title: string; step: number; total: number; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className={styles.wrap}>
      <p className={styles.progress}>{step} / {total}</p>
      <h1 className={styles.h}>{title}</h1>
      <div className={styles.body}>{children}</div>
      {footer && <div className={styles.footer}>{footer}</div>}
    </div>
  );
}
