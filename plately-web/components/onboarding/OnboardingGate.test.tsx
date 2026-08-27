import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const replace = vi.fn();
let pathname = '/explore';
vi.mock('@/i18n/navigation', () => ({
  usePathname: () => pathname,
  useRouter: () => ({ replace }),
}));

import { OnboardingGate } from './OnboardingGate';

beforeEach(() => { localStorage.clear(); replace.mockClear(); pathname = '/explore'; });

describe('OnboardingGate', () => {
  it('redirects to /login when no session', async () => {
    render(<OnboardingGate><div>APP</div></OnboardingGate>);
    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
    expect(screen.queryByText('APP')).toBeNull();
  });
  it('renders children on exempt route', () => {
    pathname = '/login';
    render(<OnboardingGate><div>LOGIN</div></OnboardingGate>);
    expect(screen.getByText('LOGIN')).toBeInTheDocument();
  });
  it('renders children when session + onboarded', async () => {
    localStorage.setItem('plately.session', JSON.stringify({ email: null, signedInAt: '2026-01-01T00:00:00Z' }));
    localStorage.setItem('plately.prefs', JSON.stringify({ profile: 'muslim', tier: 'custom', restrictions: {}, onboarded: true }));
    render(<OnboardingGate><div>APP</div></OnboardingGate>);
    await vi.waitFor(() => expect(screen.getByText('APP')).toBeInTheDocument());
    expect(replace).not.toHaveBeenCalled();
  });
  it('session but not onboarded, no profile → /onboarding/profile', async () => {
    localStorage.setItem('plately.session', JSON.stringify({ email: null, signedInAt: '2026-01-01T00:00:00Z' }));
    render(<OnboardingGate><div>APP</div></OnboardingGate>);
    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith('/onboarding/profile'));
  });
});
