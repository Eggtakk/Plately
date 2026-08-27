import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import messages from '@/messages/en.json';
import { RankingsTable } from './RankingsTable';

describe('RankingsTable', () => {
  it('defaults to gap-index descending order', () => {
    render(<NextIntlClientProvider locale="en" messages={messages}><RankingsTable /></NextIntlClientProvider>);
    const body = screen.getAllByRole('rowgroup')[1];
    const rows = within(body).getAllByRole('row');
    const firstGap = Number(within(rows[0]).getAllByRole('cell')[2].textContent);
    const secondGap = Number(within(rows[1]).getAllByRole('cell')[2].textContent);
    expect(firstGap).toBeGreaterThanOrEqual(secondGap);
  });
});
