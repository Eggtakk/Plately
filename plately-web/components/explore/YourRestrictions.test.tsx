import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import messages from '@/messages/en.json';
import { YourRestrictions } from './YourRestrictions';
import type { RestaurantAttributes, Preferences } from '@/lib/types';

const A: RestaurantAttributes = {
  containsPork: false, servesAlcohol: 'unknown', containsBeef: false, vegetarianFriendly: false,
  containsChicken: false, containsFish: false, containsSeafood: false, containsEgg: false,
  containsOnionGarlic: false, porkDerivedIngredients: false, containsGelatin: false,
  nonHalalMeat: false, halalCertified: false, crossContaminationRisk: false,
};
const P: Preferences = { profile: 'muslim', tier: 'pork-alcohol-free', restrictions: { pork: true, alcohol: true }, onboarded: true };

describe('YourRestrictions', () => {
  it('shows clear for confirmed-false and check-with-venue for unknown', () => {
    render(<NextIntlClientProvider locale="en" messages={messages}><YourRestrictions prefs={P} attributes={A} /></NextIntlClientProvider>);
    expect(screen.getByText('Pork').closest('li')).toHaveAttribute('data-state', 'ok');
    expect(screen.getByText('Alcohol in food').closest('li')).toHaveAttribute('data-state', 'unknown');
  });
  it('renders nothing when no active restrictions', () => {
    const { container } = render(<NextIntlClientProvider locale="en" messages={messages}><YourRestrictions prefs={{ ...P, restrictions: {} }} attributes={A} /></NextIntlClientProvider>);
    expect(container).toBeEmptyDOMElement();
  });
});
