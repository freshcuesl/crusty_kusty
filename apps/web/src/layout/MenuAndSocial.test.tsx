import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { as, renderApp } from '../test/renderApp';

afterEach(() => {
  vi.unstubAllEnvs();
});

async function openMenu() {
  await userEvent.click(await screen.findByRole('button', { name: 'Account menu' }));
  return screen.findByRole('menu');
}

describe('account menu', () => {
  it('gives business owners their business pages', async () => {
    renderApp('/', as.verifiedOwner);
    const menu = await openMenu();
    for (const item of ['Verification', 'Team', 'Plan and billing', 'Security', 'Sign out']) {
      expect(within(menu).getByRole('menuitem', { name: item })).toBeInTheDocument();
    }
    expect(within(menu).queryByRole('menuitem', { name: 'Admin panel' })).not.toBeInTheDocument();
  });

  it('keeps staff menus short: admin panel, security and sign out', async () => {
    renderApp('/', { ...as.verifiedOwner, rpc: { my_platform_role: 'admin' } });
    const menu = await openMenu();
    expect(await within(menu).findByRole('menuitem', { name: 'Admin panel' })).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: 'Security' })).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: 'Sign out' })).toBeInTheDocument();
    for (const item of ['Verification', 'Team', 'Plan and billing']) {
      expect(within(menu).queryByRole('menuitem', { name: item })).not.toBeInTheDocument();
    }
  });
});

describe('social media links', () => {
  function withSocial() {
    vi.stubEnv('VITE_SOCIAL_FACEBOOK', 'https://facebook.com/clientshield');
    vi.stubEnv('VITE_SOCIAL_INSTAGRAM', 'https://instagram.com/clientshield');
    vi.stubEnv('VITE_SOCIAL_X', 'https://x.com/clientshield');
  }

  it('shows Facebook, Instagram and X in the site header', async () => {
    withSocial();
    renderApp('/', as.signedOut);
    const nav = await screen.findByRole('navigation', { name: 'Site' });
    const social = within(nav).getByRole('list', { name: 'ClientShield on social media' });
    const facebook = within(social).getByRole('link', { name: 'ClientShield on Facebook' });
    expect(facebook).toHaveAttribute('href', 'https://facebook.com/clientshield');
    expect(facebook).toHaveAttribute('target', '_blank');
    expect(facebook).toHaveAttribute('rel', 'noopener noreferrer');
    expect(
      within(social).getByRole('link', { name: 'ClientShield on Instagram' }),
    ).toBeInTheDocument();
    expect(within(social).getByRole('link', { name: 'ClientShield on X' })).toBeInTheDocument();
  });

  it('repeats them in the footer', async () => {
    withSocial();
    renderApp('/', as.signedOut);
    const footer = await screen.findByRole('contentinfo');
    expect(
      within(footer).getByRole('link', { name: 'ClientShield on Facebook' }),
    ).toBeInTheDocument();
  });

  it('shows placeholder links until the real accounts are set up', async () => {
    vi.stubEnv('VITE_SOCIAL_INSTAGRAM', 'https://instagram.com/clientshield');
    renderApp('/', as.signedOut);
    const nav = await screen.findByRole('navigation', { name: 'Site' });
    expect(within(nav).getByRole('link', { name: 'ClientShield on Instagram' })).toHaveAttribute(
      'href',
      'https://instagram.com/clientshield',
    );
    expect(within(nav).getByRole('link', { name: 'ClientShield on Facebook' })).toHaveAttribute(
      'href',
      'https://www.facebook.com/',
    );
    expect(within(nav).getByRole('link', { name: 'ClientShield on X' })).toHaveAttribute(
      'href',
      'https://x.com/',
    );
  });

  it('never links anywhere unsafe', async () => {
    vi.stubEnv('VITE_SOCIAL_FACEBOOK', 'javascript:alert(1)');
    renderApp('/', as.signedOut);
    await screen.findByRole('navigation', { name: 'Site' });
    expect(
      screen.queryByRole('link', { name: 'ClientShield on Facebook' }),
    ).not.toBeInTheDocument();
  });
});
