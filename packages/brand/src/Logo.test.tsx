import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Logo } from './Logo';

describe('<Logo />', () => {
  it('is announced to screen readers as "Crusty Krustees"', () => {
    render(<Logo />);
    expect(screen.getByRole('img', { name: 'Crusty Krustees' })).toBeInTheDocument();
  });

  it('shows the wordmark next to the crab when asked', () => {
    render(<Logo withWordmark />);
    expect(screen.getByText('Crusty')).toBeInTheDocument();
    expect(screen.getByText('Krustees')).toBeInTheDocument();
  });

  it('hides the wordmark by default', () => {
    render(<Logo />);
    expect(screen.queryByText('Krustees')).not.toBeInTheDocument();
  });

  it('can be hidden from screen readers when purely decorative', () => {
    const { container } = render(<Logo decorative />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('scales to the requested size', () => {
    const { container } = render(<Logo size={96} />);
    expect(container.querySelector('svg')).toHaveAttribute('width', '96');
  });
});
