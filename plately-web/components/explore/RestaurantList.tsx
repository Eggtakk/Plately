import type { Restaurant } from '@/lib/types';
import { RestaurantCard } from './RestaurantCard';
import styles from './RestaurantList.module.css';

export function RestaurantList({ items, emptyLabel }: { items: Restaurant[]; emptyLabel?: string }) {
  return (
    <div className={styles.list}>
      {items.map((r) => <RestaurantCard key={r.id} r={r} />)}
      {items.length === 0 && (
        <p className={styles.empty}>{emptyLabel ?? 'No matches — try removing a filter.'}</p>
      )}
    </div>
  );
}
