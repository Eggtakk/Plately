import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OnboardingCard } from './OnboardingCard';

describe('OnboardingCard', () => {
  it('reflects selected state and fires onSelect', async () => {
    const onSelect = vi.fn();
    render(<OnboardingCard title="Muslim" selected={false} onSelect={onSelect} />);
    const btn = screen.getByRole('button', { name: /muslim/i });
    expect(btn).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(btn);
    expect(onSelect).toHaveBeenCalledOnce();
  });
});
