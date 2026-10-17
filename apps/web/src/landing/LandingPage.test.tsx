import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { as, renderApp } from '../test/renderApp';

describe('landing page', () => {
  it('greets signed-out visitors at the home address instead of the sign-in form', async () => {
    const { path } = renderApp('/', as.signedOut);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Know before you go.' }),
    ).toBeInTheDocument();
    expect(path()).toBe('/');
  });

  it('invites contractors to sign up and lets members sign in', async () => {
    renderApp('/', as.signedOut);
    const hero = await screen.findByRole('region', { name: 'Know before you go.' });
    expect(within(hero).getByRole('link', { name: 'Get started free' })).toHaveAttribute(
      'href',
      '/sign-up',
    );
    const nav = screen.getByRole('navigation', { name: 'Site' });
    expect(within(nav).getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/sign-in');
  });

  it('shows an example of the private alert a contractor receives', async () => {
    renderApp('/', as.signedOut);
    const example = await screen.findByRole('figure', { name: 'Example alert on a phone' });
    expect(within(example).getByText('Verified incident found')).toBeInTheDocument();
    expect(within(example).getByText('Review incident')).toBeInTheDocument();
  });

  it('explains how it works in four steps', async () => {
    renderApp('/', as.signedOut);
    const steps = await screen.findByRole('list', { name: 'How it works' });
    expect(within(steps).getAllByRole('listitem')).toHaveLength(4);
  });

  it('makes clear it is not a blacklist', async () => {
    renderApp('/', as.signedOut);
    expect(await screen.findByRole('heading', { name: 'Facts, not labels' })).toBeInTheDocument();
    expect(screen.getByText(/No public people search/)).toBeInTheDocument();
  });

  it('jumps to the explanation from the hero', async () => {
    renderApp('/', as.signedOut);
    expect(await screen.findByRole('link', { name: 'See how it works' })).toHaveAttribute(
      'href',
      '#how-it-works',
    );
  });

  it('still sends signed-out visitors to sign in for app pages', async () => {
    const { path } = renderApp('/alerts', as.signedOut);
    await waitFor(() => expect(path()).toBe('/sign-in'));
  });

  it('signed-in members get the app, not the landing page', async () => {
    renderApp('/', as.owner);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'What do you need?' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Know before you go.')).not.toBeInTheDocument();
  });

  it('a signed-in visitor clicking the logo on sign-in pages comes back to the landing page', async () => {
    const { path } = renderApp('/sign-in', as.signedOut);
    await userEvent.click(await screen.findByRole('link', { name: 'ClientShield home' }));
    await waitFor(() => expect(path()).toBe('/'));
  });
});

describe('admin panel link', () => {
  it('appears in the account menu for moderators', async () => {
    renderApp('/', { ...as.owner, rpc: { my_platform_role: 'moderator' } });
    await userEvent.click(await screen.findByRole('button', { name: 'Account menu' }));
    expect(await screen.findByRole('menuitem', { name: 'Admin panel' })).toHaveAttribute(
      'href',
      'http://localhost:5174',
    );
  });

  it('is hidden from regular members', async () => {
    renderApp('/', as.owner);
    await userEvent.click(await screen.findByRole('button', { name: 'Account menu' }));
    await screen.findByRole('menuitem', { name: 'Sign out' });
    expect(screen.queryByRole('menuitem', { name: 'Admin panel' })).not.toBeInTheDocument();
  });
});

describe('landing page pricing', () => {
  it('is linked from the header', async () => {
    renderApp('/', as.signedOut);
    const nav = await screen.findByRole('navigation', { name: 'Site' });
    expect(within(nav).getByRole('link', { name: 'Pricing' })).toHaveAttribute('href', '#pricing');
  });

  it('shows every plan with its monthly price', async () => {
    renderApp('/', as.signedOut);
    const pricing = await screen.findByRole('region', { name: 'Simple plans. Start free.' });
    const plans = within(pricing).getByRole('list', { name: 'Plans' });
    expect(within(plans).getByRole('listitem', { name: 'Free' })).toHaveTextContent('$0');
    expect(within(plans).getByRole('listitem', { name: 'Pro' })).toHaveTextContent('$29');
    expect(within(plans).getByRole('listitem', { name: 'Team' })).toHaveTextContent('$59');
    expect(within(plans).getByRole('listitem', { name: 'Business' })).toHaveTextContent(
      'Contact us',
    );
    expect(within(plans).getByRole('listitem', { name: 'Pro' })).toHaveTextContent('Most popular');
  });

  it('switches to yearly prices', async () => {
    renderApp('/', as.signedOut);
    const pricing = await screen.findByRole('region', { name: 'Simple plans. Start free.' });
    await userEvent.click(within(pricing).getByRole('button', { name: 'Yearly' }));
    const pro = within(pricing).getByRole('listitem', { name: 'Pro' });
    expect(pro).toHaveTextContent('$290');
    expect(pro).toHaveTextContent('2 months free');
  });

  it('sends visitors to sign up, with the free trial explained', async () => {
    renderApp('/', as.signedOut);
    const pricing = await screen.findByRole('region', { name: 'Simple plans. Start free.' });
    const pro = within(pricing).getByRole('listitem', { name: 'Pro' });
    expect(within(pro).getByRole('link', { name: 'Start 14-day free trial' })).toHaveAttribute(
      'href',
      '/sign-up',
    );
    expect(
      within(within(pricing).getByRole('listitem', { name: 'Free' })).getByRole('link', {
        name: 'Start free',
      }),
    ).toHaveAttribute('href', '/sign-up');
    expect(pricing).toHaveTextContent(/no card needed/i);
  });

  it('answers common questions', async () => {
    renderApp('/', as.signedOut);
    const faq = await screen.findByRole('region', { name: 'Questions about pricing' });
    expect(within(faq).getByText('What counts as a customer check?')).toBeInTheDocument();
    expect(within(faq).getByText('What happens when the trial ends?')).toBeInTheDocument();
  });
});
