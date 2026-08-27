import { setRequestLocale } from 'next-intl/server';
import { DetailsStep } from './DetailsStep';

export default async function DetailsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <DetailsStep />;
}
