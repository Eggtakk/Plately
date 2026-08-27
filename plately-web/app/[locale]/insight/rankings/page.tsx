import { setRequestLocale } from 'next-intl/server';
import { RankingsTable } from '@/components/insight/RankingsTable';

export default async function RankingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <RankingsTable />;
}
