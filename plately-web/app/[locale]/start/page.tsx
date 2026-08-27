import { setRequestLocale } from 'next-intl/server';
import { OnboardingFlow } from './OnboardingFlow';

export default async function StartPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <OnboardingFlow />;
}
