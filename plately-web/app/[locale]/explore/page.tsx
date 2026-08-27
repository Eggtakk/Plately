import { setRequestLocale } from 'next-intl/server';
import { ExploreView } from './ExploreView';

export default async function ExplorePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ExploreView />;
}
