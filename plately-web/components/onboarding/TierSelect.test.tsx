import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import messages from '@/messages/en.json';
import { TierSelect } from './TierSelect';

describe('TierSelect', () => {
  it('renders the muslim tiers and fires onChange', async () => {
    const onChange = vi.fn();
    render(<NextIntlClientProvider locale="en" messages={messages}><TierSelect profile="muslim" value={null} onChange={onChange} /></NextIntlClientProvider>);
    expect(screen.getByRole('radio', { name: 'Pork & alcohol free' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: 'Halal-certified only' }));
    expect(onChange).toHaveBeenCalledWith('halal-certified');
  });
});
