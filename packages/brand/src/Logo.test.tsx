import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Logo } from './Logo';
import { brand } from './tokens';

describe('<Logo />', () => {
  it('is announced to screen readers as "ClientShield"', () => {
    render(<Logo />);
    expect(screen.getByRole('img', { name: 'ClientShield' })).toBeInTheDocument();
  });

  it('shows the wordmark next to the shield when asked', () => {
    render(<Logo withWordmark />);
    expect(screen.getByText('Client')).toBeInTheDocument();
    expect(screen.getByText('Shield')).toBeInTheDocument();
  });

  it('hides the wordmark by default', () => {
    render(<Logo />);
    expect(screen.queryByText('Shield')).not.toBeInTheDocument();
  });

  it('can be hidden from screen readers when purely decorative', () => {
    const { container } = render(<Logo decorative />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('scales to the requested height', () => {
    const { container } = render(<Logo size={96} />);
    expect(container.querySelector('svg')).toHaveAttribute('height', '96');
  });

  it('uses the darker teal for "Shield" on light backgrounds, for contrast', () => {
    render(<Logo withWordmark />);
    expect(screen.getByText('Shield')).toHaveStyle({ color: brand.tealDark });
  });

  it('uses the bright teal on dark backgrounds such as the midnight header', () => {
    render(<Logo withWordmark onDark />);
    expect(screen.getByText('Shield')).toHaveStyle({ color: brand.teal });
  });

  it('draws a light shield on dark backgrounds so it stays visible', () => {
    const { container } = render(<Logo onDark />);
    expect(container.querySelector('[data-part="shield"]')).toHaveAttribute('fill', brand.mist);
  });

  it('draws a midnight shield on light backgrounds', () => {
    const { container } = render(<Logo />);
    expect(container.querySelector('[data-part="shield"]')).toHaveAttribute('fill', brand.midnight);
  });
});
