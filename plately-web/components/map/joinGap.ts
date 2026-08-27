import type { RegionGap } from '@/lib/types';

type GeoJson = { type: 'FeatureCollection'; features: Array<{ type: 'Feature'; properties: Record<string, unknown>; geometry: unknown }> };

export function joinGapIntoGeoJson(geo: GeoJson, rows: RegionGap[]): GeoJson {
  const byCode = new Map(rows.map((r) => [r.code, r]));
  return {
    ...geo,
    features: geo.features.map((f) => {
      const row = byCode.get(String(f.properties.code));
      return {
        ...f,
        properties: {
          ...f.properties,
          gapIndex: row?.gapIndex ?? 0,
          demandScore: row?.demandScore ?? 0,
          supplyCount: row?.supplyCount ?? 0,
        },
      };
    }),
  };
}
