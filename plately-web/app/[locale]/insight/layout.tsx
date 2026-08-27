import { setRequestLocale } from 'next-intl/server';
import { TopBar } from '@/components/chrome/TopBar';
import { InsightNav } from '@/components/insight/InsightNav';

export default async function InsightLayout({
  children, params,
}: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <>
      <TopBar />
      <InsightNav />
      <main>{children}</main>
    </>
  );
}
