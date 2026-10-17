import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { as, renderApp } from '../test/renderApp';
import { BEACON_ID, loadWebAnalytics } from './webAnalytics';

const beacon = () => document.getElementById(BEACON_ID) as HTMLScriptElement | null;

afterEach(() => {
  beacon()?.remove();
  vi.unstubAllEnvs();
});

describe('visitor stats (Cloudflare Web Analytics)', () => {
  it('counts landing page visits when a token is configured', async () => {
    vi.stubEnv('VITE_CF_ANALYTICS_TOKEN', 'abc123');
    renderApp('/', as.signedOut);
    await screen.findByRole('heading', { level: 1, name: 'Know before you go.' });
    const script = beacon();
    expect(script?.src).toBe('https://static.cloudflareinsights.com/beacon.min.js');
    expect(script?.defer).toBe(true);
    // spa:false: it records this page load only, never the app pages a member opens later.
    expect(JSON.parse(script?.dataset.cfBeacon ?? '{}')).toEqual({ token: 'abc123', spa: false });
  });

  it('is off without a token (local development)', async () => {
    renderApp('/', as.signedOut);
    await screen.findByRole('heading', { level: 1, name: 'Know before you go.' });
    expect(beacon()).toBeNull();
  });

  it('never runs inside the app', async () => {
    vi.stubEnv('VITE_CF_ANALYTICS_TOKEN', 'abc123');
    renderApp('/', as.verifiedOwner);
    await screen.findByRole('heading', { name: 'What do you need?' });
    expect(beacon()).toBeNull();
  });

  it('adds the script only once', () => {
    loadWebAnalytics('abc123');
    loadWebAnalytics('abc123');
    expect(document.querySelectorAll(`#${BEACON_ID}`)).toHaveLength(1);
  });
});
