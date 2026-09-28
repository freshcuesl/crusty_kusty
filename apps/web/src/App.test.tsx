import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { App, AppRoutes } from './App';
import { renderWithProviders } from './test/renderWithProviders';

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [false, vi.fn()],
    offlineReady: [false, vi.fn()],
    updateServiceWorker: vi.fn(),
  }),
}));

describe('app shell', () => {
  it('shows the Crusty Krustees logo in the header', () => {
    renderWithProviders(<AppRoutes />);
    const header = screen.getByRole('banner');
    expect(within(header).getByRole('img', { name: 'Crusty Krustees' })).toBeInTheDocument();
  });

  it('lets keyboard users skip straight to the main content', () => {
    renderWithProviders(<AppRoutes />);
    expect(screen.getByRole('link', { name: 'Skip to main content' })).toHaveAttribute(
      'href',
      '#main',
    );
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main');
  });
});

describe('home screen', () => {
  it.each([
    ['New customer', '/customers/new'],
    ['Report incident', '/incidents/new'],
    ['Customer check', '/check'],
    ['My incidents', '/incidents'],
    ['Alerts', '/alerts'],
  ])('offers "%s"', (label, href) => {
    renderWithProviders(<AppRoutes />);
    expect(screen.getByRole('link', { name: new RegExp(label) })).toHaveAttribute('href', href);
  });

  it('opens a placeholder for features still being built', async () => {
    renderWithProviders(<AppRoutes />);
    await userEvent.click(screen.getByRole('link', { name: /Report incident/ }));
    expect(screen.getByRole('heading', { name: 'Report incident' })).toBeInTheDocument();
    expect(screen.getByText(/coming soon/i)).toBeInTheDocument();
  });

  it('can go back home from a placeholder', async () => {
    renderWithProviders(<AppRoutes />, { route: '/alerts' });
    await userEvent.click(screen.getByRole('link', { name: 'Back to home' }));
    expect(screen.getByRole('link', { name: /Customer check/ })).toBeInTheDocument();
  });
});

describe('unknown pages', () => {
  it('shows a friendly not-found page', () => {
    renderWithProviders(<AppRoutes />, { route: '/does-not-exist' });
    expect(screen.getByRole('heading', { name: /page not found/i })).toBeInTheDocument();
  });
});

describe('<App />', () => {
  it('boots with the real router and theme', () => {
    render(<App />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'What do you need?' }),
    ).toBeInTheDocument();
  });
});
