import { setRequestLocale } from 'next-intl/server';
import { LanguageStep } from './LanguageStep';

export default async function LanguagePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <LanguageStep />;
}
