'use client';
import { useEffect } from 'react';
import { usePathname, useRouter } from '@/i18n/navigation';
import { useSession } from '@/lib/useSession';
import { usePreferences } from '@/lib/usePreferences';
import { OnboardingSplash } from './OnboardingSplash';

const EXEMPT = /^\/(login|onboarding)(\/|$)/;

export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { session, hydrated: sh } = useSession();
  const { prefs, hydrated: ph } = usePreferences();
  const ready = sh && ph;
  const exempt = EXEMPT.test(pathname);

  useEffect(() => {
    if (!ready || exempt) return;
    if (!session) { router.replace('/login'); return; }
    if (!prefs.onboarded) {
      router.replace(prefs.profile ? '/onboarding/details' : '/onboarding/profile');
    }
  }, [ready, exempt, session, prefs.onboarded, prefs.profile, router]);

  if (exempt) return <>{children}</>;
  if (!ready) return <OnboardingSplash />;
  if (!session || !prefs.onboarded) return <OnboardingSplash />;
  return <>{children}</>;
}
