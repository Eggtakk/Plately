'use client';
import { useEffect, useRef } from 'react';
import maplibregl, { Map as MlMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MAP_STYLE_URL, KOREA_CENTER } from './mapStyle';
import styles from './BaseMap.module.css';

export function BaseMap({
  center = KOREA_CENTER, zoom = 6, onReady, className, label = 'Map',
}: {
  center?: [number, number]; zoom?: number;
  onReady?: (map: MlMap) => void; className?: string; label?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: ref.current,
      style: MAP_STYLE_URL,
      center,
      zoom,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.on('load', () => onReady?.(map));
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={ref} className={`${styles.map} ${className ?? ''}`} role="application" aria-label={label} />;
}
