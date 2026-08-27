import { useTranslations } from 'next-intl';
import type { RestaurantAttributes } from '@/lib/types';
import styles from './AttributeList.module.css';

function mark(v: boolean | 'unknown', t: (k: string) => string) {
  if (v === 'unknown') return t('unknown');
  return v ? t('yes') : t('no');
}

export function AttributeList({ a }: { a: RestaurantAttributes }) {
  const t = useTranslations('restaurant');
  const rows: [string, boolean | 'unknown', boolean][] = [
    [t('containsPork'), a.containsPork, a.containsPork === false],
    [t('servesAlcohol'), a.servesAlcohol, a.servesAlcohol === false],
    [t('containsBeef'), a.containsBeef, a.containsBeef === false],
    [t('vegetarianFriendly'), a.vegetarianFriendly, a.vegetarianFriendly === true],
  ];
  return (
    <ul className={styles.list}>
      {rows.map(([label, val, good]) => (
        <li key={label} className={styles.row} data-good={good}>
          <span>{label}</span><span className="tnum">{mark(val, t)}</span>
        </li>
      ))}
    </ul>
  );
}
