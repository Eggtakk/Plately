import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['en', 'ko', 'ar', 'hi'],
  defaultLocale: 'en',
  localePrefix: 'always',
});

export type Locale = (typeof routing.locales)[number];
export const rtlLocales: Locale[] = ['ar'];
export const dirFor = (l: Locale) => (rtlLocales.includes(l) ? 'rtl' : 'ltr');
