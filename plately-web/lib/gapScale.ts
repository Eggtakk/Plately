export const GAP_STOPS = [
  { at: 0, color: '#1F6E52' },
  { at: 50, color: '#E0A458' },
  { at: 100, color: '#B4472E' },
] as const;

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));

export function gapColor(value: number): string {
  const v = clamp(value);
  for (let i = 1; i < GAP_STOPS.length; i++) {
    const a = GAP_STOPS[i - 1];
    const b = GAP_STOPS[i];
    if (v <= b.at) {
      // Return the exact stop color when the value lands on a stop, so callers
      // get the canonical casing from GAP_STOPS rather than lerpHex's lowercase.
      if (v === a.at) return a.color;
      if (v === b.at) return b.color;
      const t = (v - a.at) / (b.at - a.at || 1);
      return lerpHex(a.color, b.color, t);
    }
  }
  return GAP_STOPS[GAP_STOPS.length - 1].color;
}

export function gapBucket(value: number): 'low' | 'medium' | 'high' {
  const v = clamp(value);
  return v < 33 ? 'low' : v < 67 ? 'medium' : 'high';
}

/** MapLibre `interpolate` expression stops, for the fill layer. */
export function gapInterpolateStops(): (number | string)[] {
  return GAP_STOPS.flatMap((s) => [s.at, s.color]);
}

function lerpHex(a: string, b: string, t: number): string {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  const mix = pa.map((c, i) => Math.round(c + (pb[i] - c) * t));
  return '#' + mix.map((c) => c.toString(16).padStart(2, '0')).join('');
}
