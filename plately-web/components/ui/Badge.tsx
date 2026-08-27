import styles from './Badge.module.css';

type Tone = 'phone' | 'menu' | 'name' | 'neutral';
export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: React.ReactNode }) {
  return <span className={styles.badge} data-tone={tone}>{children}</span>;
}
