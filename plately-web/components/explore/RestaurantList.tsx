import type { Restaurant } from '@/lib/types';
import { RestaurantCard } from './RestaurantCard';
import styles from './RestaurantList.module.css';

export function RestaurantList({ items }: { items: Restaurant[] }) {
  return (
    <div className={styles.list}>
      {items.map((r) => <RestaurantCard key={r.id} r={r} />)}
      {items.length === 0 && <p className={styles.empty}>No matches — try removing a filter.</p>}
    </div>
  );
}
