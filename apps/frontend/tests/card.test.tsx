import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Card, CardTitle } from '@/components/ui/card';

describe('Card', () => {
  it('highlights interactive cards with a soft border and elevation', () => {
    render(<Card variant="interactive" data-testid="c" />);
    const card = screen.getByTestId('c');
    expect(card).toHaveClass('rounded-lg', 'hover:border-border', 'hover:shadow-sw-nested');
    expect(card.className).not.toMatch(/translate-|transition-all/);
  });

  it('leaves the focus ring to the link or button inside, since the card itself is not focusable', () => {
    render(
      <Card variant="interactive" data-testid="c">
        <button type="button">Open</button>
      </Card>
    );
    expect(screen.getByTestId('c').className).not.toMatch(/focus-visible/);
    expect(screen.getByTestId('c')).not.toHaveAttribute('tabindex');
  });

  it('offers a raised resting frame for cards on bare canvas', () => {
    render(<Card variant="raised" data-testid="c" />);
    expect(screen.getByTestId('c')).toHaveClass(
      'rounded-lg',
      'bg-white',
      'border',
      'border-border',
      'shadow-sw-nested'
    );
  });

  it('sets card titles in bold serif', () => {
    render(<CardTitle>Title</CardTitle>);
    expect(screen.getByText('Title')).toHaveClass('font-serif', 'font-bold');
  });
});
