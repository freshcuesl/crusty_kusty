import { describe, expect, it, vi } from 'vitest';
import {
  handleCreateSession,
  handleStripeWebhook,
  type CreateSessionDeps,
  type WebhookDeps,
} from './identity.ts';

const APP_URL = 'https://app.clientshield.test';

function createDeps(overrides: Partial<CreateSessionDeps> = {}): CreateSessionDeps {
  return {
    appUrl: APP_URL,
    now: () => new Date('2026-10-17T12:00:00Z'),
    getCaller: vi.fn(async () => ({ userId: 'u1', aal: 'aal2' })),
    getOwnerBusinessId: vi.fn(async () => 'b1'),
    isOwnerVerified: vi.fn(async () => false),
    countSessionsSince: vi.fn(async () => 0),
    createStripeSession: vi.fn(async () => ({
      id: 'vs_123',
      url: 'https://verify.stripe.com/start/abc',
    })),
    recordSession: vi.fn(async () => {}),
    ...overrides,
  };
}

const post = (headers: Record<string, string> = { Authorization: 'Bearer token' }) =>
  new Request('https://fn.test/create-identity-session', { method: 'POST', headers });

describe('create-identity-session', () => {
  it('starts a Stripe ID + selfie check and returns the Stripe page to open', async () => {
    const deps = createDeps();
    const res = await handleCreateSession(post(), deps);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: 'https://verify.stripe.com/start/abc' });
    expect(deps.createStripeSession).toHaveBeenCalledWith({
      userId: 'u1',
      businessId: 'b1',
      returnUrl: `${APP_URL}/verification?identity=returned`,
    });
    expect(deps.recordSession).toHaveBeenCalledWith({
      business_id: 'b1',
      user_id: 'u1',
      stripe_session_id: 'vs_123',
      status: 'requires_input',
    });
  });

  it('never lets the browser choose where Stripe sends people back', async () => {
    const deps = createDeps();
    const req = new Request('https://fn.test/x', {
      method: 'POST',
      headers: { Authorization: 'Bearer token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ returnUrl: 'https://evil.example/phish' }),
    });
    await handleCreateSession(req, deps);
    expect(deps.createStripeSession).toHaveBeenCalledWith(
      expect.objectContaining({ returnUrl: `${APP_URL}/verification?identity=returned` }),
    );
  });

  it('answers the browser preflight for the app origin only', async () => {
    const res = await handleCreateSession(
      new Request('https://fn.test/x', { method: 'OPTIONS' }),
      createDeps(),
    );
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(APP_URL);
  });

  it('refuses anything but POST', async () => {
    const res = await handleCreateSession(
      new Request('https://fn.test/x', { method: 'GET' }),
      createDeps(),
    );
    expect(res.status).toBe(405);
  });

  it('requires a signed-in user', async () => {
    const res = await handleCreateSession(
      post({}),
      createDeps({ getCaller: vi.fn(async () => null) }),
    );
    expect(res.status).toBe(401);
  });

  it('requires two-step login', async () => {
    const res = await handleCreateSession(
      post(),
      createDeps({ getCaller: vi.fn(async () => ({ userId: 'u1', aal: 'aal1' })) }),
    );
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'Two-step login required.' });
  });

  it('is only for business owners', async () => {
    const res = await handleCreateSession(
      post(),
      createDeps({ getOwnerBusinessId: vi.fn(async () => null) }),
    );
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'Only the business owner can verify identity.' });
  });

  it('does not start another check once verified', async () => {
    const deps = createDeps({ isOwnerVerified: vi.fn(async () => true) });
    const res = await handleCreateSession(post(), deps);
    expect(res.status).toBe(409);
    expect(deps.createStripeSession).not.toHaveBeenCalled();
  });

  it('limits attempts to 5 per day', async () => {
    const deps = createDeps({ countSessionsSince: vi.fn(async () => 5) });
    const res = await handleCreateSession(post(), deps);
    expect(res.status).toBe(429);
    expect(deps.countSessionsSince).toHaveBeenCalledWith('u1', '2026-10-16T12:00:00.000Z');
    expect(deps.createStripeSession).not.toHaveBeenCalled();
  });

  it('hides internal errors from the browser', async () => {
    const res = await handleCreateSession(
      post(),
      createDeps({
        createStripeSession: vi.fn(async () => {
          throw new Error('Stripe API key sk_test_123 is invalid');
        }),
      }),
    );
    expect(res.status).toBe(500);
    const body = await res.text();
    expect(body).not.toContain('sk_test');
    expect(JSON.parse(body)).toEqual({
      error: 'Could not start identity verification. Try again in a moment.',
    });
  });
});

function webhookDeps(overrides: Partial<WebhookDeps> = {}): WebhookDeps {
  return {
    verifyEvent: vi.fn(async (body: string) => JSON.parse(body)),
    recordResult: vi.fn(async () => {}),
    ...overrides,
  };
}

const stripeEvent = (type: string, object: Record<string, unknown> = {}) =>
  new Request('https://fn.test/stripe-webhook', {
    method: 'POST',
    headers: { 'Stripe-Signature': 't=1,v1=abc' },
    body: JSON.stringify({ type, data: { object: { id: 'vs_123', ...object } } }),
  });

describe('stripe-webhook', () => {
  it.each([
    ['identity.verification_session.verified', 'verified'],
    ['identity.verification_session.processing', 'processing'],
    ['identity.verification_session.canceled', 'canceled'],
  ])('records %s as %s', async (type, status) => {
    const deps = webhookDeps();
    const res = await handleStripeWebhook(stripeEvent(type), deps);
    expect(res.status).toBe(200);
    expect(deps.recordResult).toHaveBeenCalledWith('vs_123', status, null);
  });

  it('records why Stripe needs the person to try again', async () => {
    const deps = webhookDeps();
    await handleStripeWebhook(
      stripeEvent('identity.verification_session.requires_input', {
        last_error: { code: 'selfie_face_mismatch' },
      }),
      deps,
    );
    expect(deps.recordResult).toHaveBeenCalledWith(
      'vs_123',
      'requires_input',
      'selfie_face_mismatch',
    );
  });

  it('rejects messages without a valid Stripe signature', async () => {
    const deps = webhookDeps({
      verifyEvent: vi.fn(async () => {
        throw new Error('No signatures found matching the expected signature');
      }),
    });
    const res = await handleStripeWebhook(
      stripeEvent('identity.verification_session.verified'),
      deps,
    );
    expect(res.status).toBe(400);
    expect(deps.recordResult).not.toHaveBeenCalled();
  });

  it('rejects messages with no signature header at all', async () => {
    const deps = webhookDeps();
    const res = await handleStripeWebhook(
      new Request('https://fn.test/x', { method: 'POST', body: '{}' }),
      deps,
    );
    expect(res.status).toBe(400);
    expect(deps.verifyEvent).not.toHaveBeenCalled();
  });

  it('acknowledges unrelated events without doing anything', async () => {
    const deps = webhookDeps();
    const res = await handleStripeWebhook(stripeEvent('charge.succeeded'), deps);
    expect(res.status).toBe(200);
    expect(deps.recordResult).not.toHaveBeenCalled();
  });

  it('acknowledges sessions it does not know, so Stripe stops retrying', async () => {
    const deps = webhookDeps({
      recordResult: vi.fn(async () => {
        throw Object.assign(new Error('Unknown identity session'), { code: 'P0002' });
      }),
    });
    const res = await handleStripeWebhook(
      stripeEvent('identity.verification_session.verified'),
      deps,
    );
    expect(res.status).toBe(200);
  });

  it('asks Stripe to retry when saving fails', async () => {
    const deps = webhookDeps({
      recordResult: vi.fn(async () => {
        throw new Error('database unavailable');
      }),
    });
    const res = await handleStripeWebhook(
      stripeEvent('identity.verification_session.verified'),
      deps,
    );
    expect(res.status).toBe(500);
  });
});
