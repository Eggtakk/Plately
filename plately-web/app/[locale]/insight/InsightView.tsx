'use client';
import { useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChoroplethMap } from '@/components/map/ChoroplethMap';
import { RegionList } from '@/components/insight/RegionList';
import { RegionPanel } from '@/components/insight/RegionPanel';
import { GAP_STOPS } from '@/lib/gapScale';
import { getRegions } from '@/lib/mockData';
import styles from './insight.module.css';

type Layer = 'gap' | 'demand' | 'supply';

export function InsightView() {
  const t = useTranslations('insight');
  const [layer, setLayer] = useState<Layer>('gap');
  const [picked, setPicked] = useState<string | undefined>();
  const regions = getRegions();
  const onPick = useCallback((code: string) => setPicked(code), []);

  return (
    <div className={styles.view}>
      <div className={styles.side}>
        <div className={styles.layers} role="group" aria-label={t('legendTitle')}>
          {(['gap', 'demand', 'supply'] as Layer[]).map((l) => (
            <button key={l} data-on={layer === l} onClick={() => setLayer(l)}>
              {l === 'gap' ? t('layerGap') : l === 'demand' ? t('layerDemand') : t('layerSupply')}
            </button>
          ))}
        </div>
        <div className={styles.legend} aria-hidden>
          <span className={styles.swatch} style={{ background: GAP_STOPS[0].color }} />{t('gapLow')}
          <span className={styles.swatch} style={{ background: GAP_STOPS[1].color }} />{t('gapMedium')}
          <span className={styles.swatch} style={{ background: GAP_STOPS[2].color }} />{t('gapHigh')}
        </div>
        <RegionList regions={regions} onPick={onPick} selected={picked} />
      </div>
      <div className={styles.mapWrap}>
        <ChoroplethMap layer={layer} onPick={onPick} />
        {picked && <RegionPanel code={picked} onClose={() => setPicked(undefined)} />}
      </div>
    </div>
  );
}
