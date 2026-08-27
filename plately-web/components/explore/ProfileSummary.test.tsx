/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import messages from '@/messages/en.json';
import { prefsStore } from '@/lib/usePreferences';

vi.mock('@/i18n/navigation', () => ({ Link: (p: any) => <a href={p.href} className={p.className}>{p.children}</a> }));

import { ProfileSummary } from './ProfileSummary';

beforeEach(() => { localStorage.clear(); prefsStore._reset(); });

function withIntl(node: React.ReactNode) {
  return <NextIntlClientProvider locale="en" messages={messages}>{node}</NextIntlClientProvider>;
}

describe('ProfileSummary', () => {
  it('renders nothing without a profile', () => {
    const { container } = render(withIntl(<ProfileSummary />));
    expect(container).toBeEmptyDOMElement();
  });
  it('renders the icon + tier label and links to /onboarding/details', () => {
    localStorage.setItem('plately.prefs', JSON.stringify({ profile: 'muslim', tier: 'pork-alcohol-free', restrictions: {}, onboarded: true }));
    prefsStore._reset();
    render(withIntl(<ProfileSummary />));
    expect(screen.getByText(/Pork & alcohol free/)).toBeInTheDocument();
    expect(screen.getByText('☪️')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/onboarding/details');
  });
});
