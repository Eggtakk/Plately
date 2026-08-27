import type { Locale } from './types';

export function formatGapIndex(value: number, _locale: Locale): string {
  return new Intl.NumberFormat('en', { maximumFractionDigits: 0 }).format(Math.round(value));
}
export function formatCount(value: number, locale: Locale): string {
  return new Intl.NumberFormat(locale).format(value);
}
export function formatPercent(value: number, locale: Locale): string {
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  return `${sign}${new Intl.NumberFormat(locale).format(Math.abs(value))}%`;
}
export function formatDate(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(iso));
}
