import { setRequestLocale } from 'next-intl/server';
import { ProfileStep } from './ProfileStep';

export default async function ProfilePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ProfileStep />;
}
