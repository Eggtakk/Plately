import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import messages from '@/messages/en.json';
import { RegionList } from './RegionList';
import type { RegionGap } from '@/lib/types';

const regions: RegionGap[] = [
  { code: 'a', name: { en: 'Alpha', ko: 'a' }, gwangyeok: 'X', demandScore: 1, supplyCount: 1, gapIndex: 20, trendVs2019: 0 },
  { code: 'b', name: { en: 'Bravo', ko: 'b' }, gwangyeok: 'X', demandScore: 1, supplyCount: 1, gapIndex: 90, trendVs2019: 0 },
];

describe('RegionList', () => {
  it('sorts by gap index descending and fires onPick', async () => {
    const onPick = vi.fn();
    render(<NextIntlClientProvider locale="en" messages={messages}><RegionList regions={regions} onPick={onPick} /></NextIntlClientProvider>);
    const rows = screen.getAllByRole('button');
    expect(rows[0]).toHaveTextContent('Bravo');
    await userEvent.click(rows[0]);
    expect(onPick).toHaveBeenCalledWith('b');
  });
});
