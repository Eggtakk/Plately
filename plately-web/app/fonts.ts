import {
  Noto_Sans,
  Noto_Sans_KR,
  Noto_Sans_Arabic,
  Noto_Sans_Devanagari,
} from 'next/font/google';
import type { Locale } from '@/i18n/routing';

const latin = Noto_Sans({ subsets: ['latin'], variable: '--font-latin', display: 'swap' });
const korean = Noto_Sans_KR({ subsets: ['latin'], variable: '--font-korean', display: 'swap' });
const arabic = Noto_Sans_Arabic({ subsets: ['arabic'], variable: '--font-arabic', display: 'swap' });
const devanagari = Noto_Sans_Devanagari({
  subsets: ['devanagari'],
  variable: '--font-devanagari',
  display: 'swap',
});

const all = `${latin.variable} ${korean.variable} ${arabic.variable} ${devanagari.variable}`;

const stackByLocale: Record<Locale, string> = {
  en: 'var(--font-latin)',
  ko: 'var(--font-korean), var(--font-latin)',
  ar: 'var(--font-arabic), var(--font-latin)',
  hi: 'var(--font-devanagari), var(--font-latin)',
};

export function fontClass(): string {
  return all;
}

export function fontFamily(locale: Locale): string {
  return `${stackByLocale[locale]}, system-ui, sans-serif`;
}
