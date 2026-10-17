import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { createFakeSupabase } from '@cs/core/testing';
import { as, renderApp } from './test/renderApp';

const getSupabase = vi.hoisted(() => vi.fn());
vi.mock('./lib/supabase', () => ({ getSupabase }));

describe('app shell', () => {
  it('shows the ClientShield logo in the header', async () => {
    renderApp('/', as.owner);
    const header = await screen.findByRole('banner');
    expect(within(header).getByRole('img', { name: 'ClientShield' })).toBeInTheDocument();
  });

  it('lets keyboard users skip straight to the main content', async () => {
    renderApp('/', as.owner);
    expect(await screen.findByRole('link', { name: 'Skip to main content' })).toHaveAttribute(
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
  ])('offers "%s"', async (label, href) => {
    renderApp('/', as.verifiedOwner);
    expect(await screen.findByRole('link', { name: new RegExp(label) })).toHaveAttribute(
      'href',
      href,
    );
  });

  it('explains that an unverified business is limited until verified', async () => {
    renderApp('/', as.owner);
    expect(await screen.findByText(/isn't verified yet/)).toBeInTheDocument();
  });

  it('opens the incident report form from the home screen', async () => {
    renderApp('/', as.verifiedOwner);
    await userEvent.click(await screen.findByRole('link', { name: /Report incident/ }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Report incident' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Customer name')).toBeInTheDocument();
  });
});

describe('unknown pages', () => {
  it('shows a friendly not-found page', async () => {
    renderApp('/does-not-exist', as.owner);
    expect(await screen.findByRole('heading', { name: /page not found/i })).toBeInTheDocument();
  });
});

describe('<App />', () => {
  it('boots into the landing page with the real router', async () => {
    getSupabase.mockReturnValue(createFakeSupabase().client);
    render(<App />);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Know before you go.' }),
    ).toBeInTheDocument();
  });

  it('explains how to connect when configuration is missing', () => {
    getSupabase.mockImplementation(() => {
      throw new Error('Missing or invalid environment variables: VITE_SUPABASE_URL.');
    });
    render(<App />);
    expect(
      screen.getByRole('heading', { name: "The app isn't connected yet" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/VITE_SUPABASE_URL/)).toBeInTheDocument();
  });
});
