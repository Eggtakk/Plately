import { notFound } from 'next/navigation';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { routing, dirFor, type Locale } from '@/i18n/routing';
import { fontClass, fontFamily } from '@/app/fonts';
import { ThemeScript } from '@/components/chrome/ThemeScript';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <html
      lang={locale}
      dir={dirFor(locale as Locale)}
      className={fontClass()}
    >
      <head>
        <ThemeScript />
      </head>
      <body
        style={{ ['--font-sans' as string]: fontFamily(locale as Locale) } as React.CSSProperties}
      >
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
