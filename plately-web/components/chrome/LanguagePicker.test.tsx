import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import messages from '@/messages/en.json';

vi.mock('@/i18n/navigation', () => ({
  usePathname: () => '/explore',
  useRouter: () => ({ replace: vi.fn() }),
}));

import { LanguagePicker } from './LanguagePicker';

describe('LanguagePicker', () => {
  it('renders all four locales with native names', () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <LanguagePicker />
      </NextIntlClientProvider>,
    );
    const options = screen.getAllByRole('option').map((o) => o.textContent);
    expect(options).toEqual(['English', '한국어', 'العربية', 'हिन्दी']);
  });
});
