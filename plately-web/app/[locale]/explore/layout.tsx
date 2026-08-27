import { setRequestLocale } from 'next-intl/server';
import { TopBar } from '@/components/chrome/TopBar';
import { BottomTabs } from '@/components/chrome/BottomTabs';

export default async function ExploreLayout({
  children, params,
}: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <>
      <TopBar />
      <main>{children}</main>
      <BottomTabs />
    </>
  );
}
