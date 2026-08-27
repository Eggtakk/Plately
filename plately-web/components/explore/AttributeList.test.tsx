import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import messages from '@/messages/en.json';
import { AttributeList } from './AttributeList';

describe('AttributeList', () => {
  it('renders "Unknown" for tristate alcohol', () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <AttributeList a={{ containsPork: false, servesAlcohol: 'unknown', containsBeef: false, vegetarianFriendly: false }} />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText('Unknown')).toBeInTheDocument();
  });
});
