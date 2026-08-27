'use client';
import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { getRegions } from '@/lib/mockData';
import { formatCount, formatGapIndex, formatPercent } from '@/lib/format';
import type { Locale } from '@/lib/types';
import styles from './RankingsTable.module.css';

type SortKey = 'gapIndex' | 'demandScore' | 'supplyCount' | 'trendVs2019';

export function RankingsTable() {
  const t = useTranslations('insight');
  const locale = useLocale() as Locale;
  const [sort, setSort] = useState<SortKey>('gapIndex');
  const [gwangyeok, setGwangyeok] = useState<string>('all');

  const all = getRegions();
  const gwangyeoks = useMemo(
    () => ['all', ...Array.from(new Set(all.map((r) => r.gwangyeok))).sort()],
    [all],
  );
  const rows = useMemo(() => {
    const list = gwangyeok === 'all' ? all : all.filter((r) => r.gwangyeok === gwangyeok);
    return [...list].sort((a, b) => b[sort] - a[sort]);
  }, [all, sort, gwangyeok]);

  return (
    <div className={styles.wrap}>
      <label className={styles.filter}>
        {t('province')}
        <select value={gwangyeok} onChange={(e) => setGwangyeok(e.target.value)}>
          {gwangyeoks.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
      </label>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>#</th>
            <th>{t('region')}</th>
            {(['gapIndex', 'demandScore', 'supplyCount', 'trendVs2019'] as SortKey[]).map((k) => (
              <th key={k}>
                <button type="button" onClick={() => setSort(k)} data-on={sort === k}>
                  {t(k === 'gapIndex' ? 'gapIndex' : k === 'demandScore' ? 'demand' : k === 'supplyCount' ? 'supply' : 'trend')}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.code}>
              <td className="tnum">{i + 1}</td>
              <td>{r.name[locale] ?? r.name.en}</td>
              <td className="tnum">{formatGapIndex(r.gapIndex, locale)}</td>
              <td className="tnum">{formatCount(r.demandScore, locale)}</td>
              <td className="tnum">{formatCount(r.supplyCount, locale)}</td>
              <td className="tnum">{formatPercent(r.trendVs2019, locale)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
