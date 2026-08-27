import { setRequestLocale } from 'next-intl/server';
import { InsightView } from './InsightView';

export default async function InsightPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <InsightView />;
}
