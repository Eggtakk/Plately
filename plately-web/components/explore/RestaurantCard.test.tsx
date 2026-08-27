/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import messages from '@/messages/en.json';
import type { Restaurant } from '@/lib/types';

vi.mock('@/i18n/navigation', () => ({ Link: (p: any) => <a href={p.href}>{p.children}</a> }));
import { RestaurantCard } from './RestaurantCard';

const r: Restaurant = {
  id: 'r1', name: { en: 'Sea House', ko: '바다집' }, area: { en: 'Busan', ko: '부산' },
  sigunguCode: '26350', coords: [129, 35], cuisine: 'seafood',
  attributes: {
    containsPork: false, servesAlcohol: false, containsBeef: false, vegetarianFriendly: false,
    containsChicken: false, containsFish: false, containsSeafood: false, containsEgg: false,
    containsOnionGarlic: false, porkDerivedIngredients: false, containsGelatin: false,
    nonHalalMeat: 'unknown', halalCertified: false, crossContaminationRisk: false,
  },
  confidence: 'menu', matchedTokens: [], repMenu: [],
};

describe('RestaurantCard', () => {
  it('shows localized name and confidence badge', () => {
    render(<NextIntlClientProvider locale="en" messages={messages}><RestaurantCard r={r} /></NextIntlClientProvider>);
    expect(screen.getByText('Sea House')).toBeInTheDocument();
    expect(screen.getByText('Menu-checked')).toBeInTheDocument();
  });
});
