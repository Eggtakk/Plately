'use client';
import { useEffect, useRef, useState } from 'react';
import type { Map as MlMap, GeoJSONSource, ExpressionSpecification } from 'maplibre-gl';
import { BaseMap } from './BaseMap';
import { joinGapIntoGeoJson } from './joinGap';
import { gapInterpolateStops } from '@/lib/gapScale';
import { getRegions } from '@/lib/mockData';

type Layer = 'gap' | 'demand' | 'supply';

const fillColorFor = (prop: string): ExpressionSpecification =>
  ['interpolate', ['linear'], ['get', prop], ...gapInterpolateStops()] as unknown as ExpressionSpecification;

export function ChoroplethMap({ layer = 'gap', onPick, label }: { layer?: Layer; onPick?: (code: string) => void; label?: string }) {
  const mapRef = useRef<MlMap | null>(null);
  const [ready, setReady] = useState(false);
  const onPickRef = useRef(onPick);
  useEffect(() => { onPickRef.current = onPick; }, [onPick]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    let cancelled = false;
    (async () => {
      const geo = await fetch('/sigungu.simplified.geojson').then((r) => r.json());
      if (cancelled) return;
      const joined = joinGapIntoGeoJson(geo, getRegions());
      const src = map.getSource('sigungu') as GeoJSONSource | undefined;
      if (src) {
        src.setData(joined as unknown as GeoJSON.FeatureCollection);
      } else {
        map.addSource('sigungu', { type: 'geojson', data: joined as unknown as GeoJSON.FeatureCollection });
        map.addLayer({
          id: 'sigungu-fill', type: 'fill', source: 'sigungu',
          paint: {
            'fill-color': fillColorFor('gapIndex'),
            'fill-opacity': 0.78,
          },
        });
        map.addLayer({
          id: 'sigungu-line', type: 'line', source: 'sigungu',
          paint: { 'line-color': '#FBF8F3', 'line-width': 0.5 },
        });
        map.on('click', 'sigungu-fill', (e) => {
          const code = (e.features?.[0]?.properties as { code?: string } | undefined)?.code;
          if (code) onPickRef.current?.(String(code));
        });
        map.on('mouseenter', 'sigungu-fill', () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', 'sigungu-fill', () => { map.getCanvas().style.cursor = ''; });
      }
      const prop = layer === 'demand' ? 'demandScore' : layer === 'supply' ? 'supplyCount' : 'gapIndex';
      map.setPaintProperty('sigungu-fill', 'fill-color', fillColorFor(prop));
    })();
    return () => { cancelled = true; };
    // onPick is read via onPickRef so it need not re-run this effect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, layer]);

  return <BaseMap zoom={6} label={label} onReady={(m) => { mapRef.current = m; setReady(true); }} />;
}
