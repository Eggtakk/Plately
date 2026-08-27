import { setRequestLocale } from 'next-intl/server';

export default async function OnboardingLayout({
  children, params,
}: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <main>{children}</main>;
}
