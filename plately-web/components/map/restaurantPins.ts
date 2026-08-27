import type { Map as MlMap, GeoJSONSource } from 'maplibre-gl';
import type { Restaurant } from '@/lib/types';

const SRC = 'restaurants';

export function syncPins(map: MlMap, items: Restaurant[]): void {
  const data = {
    type: 'FeatureCollection' as const,
    features: items.map((r) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: r.coords },
      properties: { id: r.id, confidence: r.confidence },
    })),
  };
  const existing = map.getSource(SRC) as GeoJSONSource | undefined;
  if (existing) { existing.setData(data); return; }
  map.addSource(SRC, { type: 'geojson', data });
  map.addLayer({
    id: 'restaurant-dots',
    type: 'circle',
    source: SRC,
    paint: {
      'circle-radius': 6,
      'circle-stroke-width': 2,
      'circle-stroke-color': '#FBF8F3',
      'circle-color': [
        'match', ['get', 'confidence'],
        'phone', '#1F6E52', 'menu', '#C56B4A', /* name */ '#9A8F79',
      ],
    },
  });
}
