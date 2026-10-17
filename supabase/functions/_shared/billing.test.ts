import { describe, expect, it, vi } from 'vitest';
import {
  handleCreateCheckout,
  handleCreatePortal,
  lookupKey,
  parseLookupKey,
  syncSubscription,
  type BillingDeps,
  type CheckoutDeps,
  type PortalDeps,
  type SubscriptionLike,
  type SyncDeps,
} from './billing.ts';

const APP_URL = 'https://app.clientshield.test';
const NOW = new Date('2026-10-21T12:00:00Z');

function baseDeps(): BillingDeps {
  return {
    appUrl: APP_URL,
    now: () => NOW,
    getCaller: vi.fn(async () => ({ userId: 'u1', email: 'owner@alpha.test', aal: 'aal2' })),
    getOwnerBusiness: vi.fn(async () => ({ businessId: 'b1', businessName: 'Alpha Plumbing' })),
    getBilling: vi.fn(async () => ({ customerId: null, status: 'none', trialEndsAt: null })),
  };
}

function checkoutDeps(overrides: Partial<CheckoutDeps> = {}): CheckoutDeps {
  return {
    ...baseDeps(),
    createCustomer: vi.fn(async () => 'cus_new'),
    saveCustomer: vi.fn(async () => {}),
    findPrice: vi.fn(async (key: string) => `price_for_${key}`),
    createCheckoutSession: vi.fn(async () => ({ url: 'https://checkout.stripe.com/c/abc' })),
    ...overrides,
  };
}

function portalDeps(overrides: Partial<PortalDeps> = {}): PortalDeps {
  return {
    ...baseDeps(),
    getBilling: vi.fn(async () => ({ customerId: 'cus_1', status: 'active', trialEndsAt: null })),
    createPortalSession: vi.fn(async () => ({ url: 'https://billing.stripe.com/p/abc' })),
    ...overrides,
  };
}

const post = (body: unknown = { plan: 'pro', interval: 'month' }) =>
  new Request('https://fn.test/create-checkout-session', {
    method: 'POST',
    headers: { Authorization: 'Bearer token', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('price lookup keys', () => {
  it('names each paid plan and billing period', () => {
    expect(lookupKey('pro', 'month')).toBe('clientshield_pro_month');
    expect(lookupKey('team', 'year')).toBe('clientshield_team_year');
  });

  it('reads plans back from Stripe prices, and ignores prices that are not ours', () => {
    expect(parseLookupKey('clientshield_team_year')).toEqual({ tier: 'team', interval: 'year' });
    expect(parseLookupKey('clientshield_gold_month')).toBeNull();
    expect(parseLookupKey(null)).toBeNull();
  });
});

describe('create-checkout-session', () => {
  it('creates a Stripe customer once and opens Checkout for the chosen plan', async () => {
    const deps = checkoutDeps();
    const res = await handleCreateCheckout(post({ plan: 'team', interval: 'year' }), deps);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: 'https://checkout.stripe.com/c/abc' });
    expect(deps.createCustomer).toHaveBeenCalledWith({
      businessId: 'b1',
      name: 'Alpha Plumbing',
      email: 'owner@alpha.test',
    });
    expect(deps.saveCustomer).toHaveBeenCalledWith('b1', 'cus_new');
    expect(deps.findPrice).toHaveBeenCalledWith('clientshield_team_year');
    expect(deps.createCheckoutSession).toHaveBeenCalledWith({
      customerId: 'cus_new',
      priceId: 'price_for_clientshield_team_year',
      businessId: 'b1',
      trialEnd: null,
      successUrl: `${APP_URL}/billing?checkout=success`,
      cancelUrl: `${APP_URL}/billing`,
    });
  });

  it('reuses the business’s Stripe customer', async () => {
    const deps = checkoutDeps({
      getBilling: vi.fn(async () => ({
        customerId: 'cus_1',
        status: 'canceled',
        trialEndsAt: null,
      })),
    });
    await handleCreateCheckout(post(), deps);
    expect(deps.createCustomer).not.toHaveBeenCalled();
    expect(deps.createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({ customerId: 'cus_1' }),
    );
  });

  it('keeps the rest of the free trial: the first charge waits until it ends', async () => {
    const trialEnd = new Date(NOW.getTime() + 10 * 24 * 3600 * 1000).toISOString();
    const deps = checkoutDeps({
      getBilling: vi.fn(async () => ({ customerId: null, status: 'none', trialEndsAt: trialEnd })),
    });
    await handleCreateCheckout(post(), deps);
    expect(deps.createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({ trialEnd: Math.floor(Date.parse(trialEnd) / 1000) }),
    );
  });

  it('charges right away when less than two days of trial are left (Stripe’s minimum)', async () => {
    const trialEnd = new Date(NOW.getTime() + 24 * 3600 * 1000).toISOString();
    const deps = checkoutDeps({
      getBilling: vi.fn(async () => ({ customerId: null, status: 'none', trialEndsAt: trialEnd })),
    });
    await handleCreateCheckout(post(), deps);
    expect(deps.createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({ trialEnd: null }),
    );
  });

  it('sends people with a subscription to Manage billing instead', async () => {
    const deps = checkoutDeps({
      getBilling: vi.fn(async () => ({ customerId: 'cus_1', status: 'active', trialEndsAt: null })),
    });
    const res = await handleCreateCheckout(post(), deps);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: 'You already have a subscription. Use Manage billing to change it.',
    });
  });

  it.each([[{ plan: 'business', interval: 'month' }], [{ plan: 'pro', interval: 'week' }], [{}]])(
    'refuses plans that cannot be bought online: %j',
    async (body) => {
      const res = await handleCreateCheckout(post(body), checkoutDeps());
      expect(res.status).toBe(400);
    },
  );

  it('refuses a body that is not JSON', async () => {
    const req = new Request('https://fn.test/x', {
      method: 'POST',
      headers: { Authorization: 'Bearer token' },
      body: 'plan=pro',
    });
    expect((await handleCreateCheckout(req, checkoutDeps())).status).toBe(400);
  });

  it('is for signed-in owners with two-step login only', async () => {
    expect(
      (await handleCreateCheckout(post(), checkoutDeps({ getCaller: vi.fn(async () => null) })))
        .status,
    ).toBe(401);
    expect(
      (
        await handleCreateCheckout(
          post(),
          checkoutDeps({
            getCaller: vi.fn(async () => ({ userId: 'u1', email: 'a@b.test', aal: 'aal1' })),
          }),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await handleCreateCheckout(
          post(),
          checkoutDeps({ getOwnerBusiness: vi.fn(async () => null) }),
        )
      ).status,
    ).toBe(403);
  });

  it('explains when billing has not been set up in Stripe yet', async () => {
    const res = await handleCreateCheckout(
      post(),
      checkoutDeps({ findPrice: vi.fn(async () => null) }),
    );
    expect(res.status).toBe(503);
  });

  it('hides Stripe errors from the browser', async () => {
    const res = await handleCreateCheckout(
      post(),
      checkoutDeps({
        createCheckoutSession: vi.fn(async () => {
          throw new Error('Invalid API key sk_test_123');
        }),
      }),
    );
    expect(res.status).toBe(500);
    expect(await res.text()).not.toContain('sk_test');
  });

  it('answers the browser preflight and refuses other methods', async () => {
    const options = await handleCreateCheckout(
      new Request('https://fn.test/x', { method: 'OPTIONS' }),
      checkoutDeps(),
    );
    expect(options.status).toBe(204);
    expect(options.headers.get('Access-Control-Allow-Origin')).toBe(APP_URL);
    const get = await handleCreateCheckout(
      new Request('https://fn.test/x', { method: 'GET' }),
      checkoutDeps(),
    );
    expect(get.status).toBe(405);
  });
});

describe('create-billing-portal', () => {
  const portalPost = () =>
    new Request('https://fn.test/create-billing-portal', {
      method: 'POST',
      headers: { Authorization: 'Bearer token' },
    });

  it('opens the Stripe billing portal and returns to the billing page', async () => {
    const deps = portalDeps();
    const res = await handleCreatePortal(portalPost(), deps);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: 'https://billing.stripe.com/p/abc' });
    expect(deps.createPortalSession).toHaveBeenCalledWith('cus_1', `${APP_URL}/billing`);
  });

  it('needs a billing account first', async () => {
    const res = await handleCreatePortal(
      portalPost(),
      portalDeps({
        getBilling: vi.fn(async () => ({ customerId: null, status: 'none', trialEndsAt: null })),
      }),
    );
    expect(res.status).toBe(409);
  });

  it('is for owners only', async () => {
    const res = await handleCreatePortal(
      portalPost(),
      portalDeps({ getOwnerBusiness: vi.fn(async () => null) }),
    );
    expect(res.status).toBe(403);
  });

  it('hides Stripe errors from the browser', async () => {
    const res = await handleCreatePortal(
      portalPost(),
      portalDeps({
        createPortalSession: vi.fn(async () => {
          throw new Error('No configuration provided');
        }),
      }),
    );
    expect(res.status).toBe(500);
  });
});

describe('syncSubscription', () => {
  const subscription = (overrides: Partial<SubscriptionLike> = {}): SubscriptionLike => ({
    id: 'sub_1',
    customer: 'cus_1',
    status: 'active',
    cancel_at_period_end: false,
    metadata: { business_id: 'b1' },
    items: {
      data: [
        {
          current_period_end: 1_800_000_000,
          price: { lookup_key: 'clientshield_team_month', recurring: { interval: 'month' } },
        },
      ],
    },
    ...overrides,
  });

  function syncDeps(sub: SubscriptionLike, overrides: Partial<SyncDeps> = {}): SyncDeps {
    return {
      retrieve: vi.fn(async () => sub),
      businessForCustomer: vi.fn(async () => 'b-from-customer'),
      record: vi.fn(async () => {}),
      ...overrides,
    };
  }

  it('copies the latest state from Stripe', async () => {
    const deps = syncDeps(subscription({ cancel_at_period_end: true }));
    await syncSubscription('sub_1', deps);
    expect(deps.retrieve).toHaveBeenCalledWith('sub_1');
    expect(deps.record).toHaveBeenCalledWith({
      p_business_id: 'b1',
      p_customer_id: 'cus_1',
      p_subscription_id: 'sub_1',
      p_tier: 'team',
      p_status: 'active',
      p_interval: 'month',
      p_period_end: new Date(1_800_000_000 * 1000).toISOString(),
      p_cancel_at_period_end: true,
    });
  });

  it('finds the business by Stripe customer when metadata is missing', async () => {
    const deps = syncDeps(subscription({ metadata: {}, customer: { id: 'cus_9' } }));
    await syncSubscription('sub_1', deps);
    expect(deps.businessForCustomer).toHaveBeenCalledWith('cus_9');
    expect(deps.record).toHaveBeenCalledWith(
      expect.objectContaining({ p_business_id: 'b-from-customer', p_customer_id: 'cus_9' }),
    );
  });

  it('treats subscriptions it cannot place as not ours', async () => {
    const unknownBusiness = syncDeps(subscription({ metadata: {} }), {
      businessForCustomer: vi.fn(async () => null),
    });
    await expect(syncSubscription('sub_1', unknownBusiness)).rejects.toMatchObject({
      code: 'P0002',
    });

    const otherPrice = subscription();
    otherPrice.items.data[0]!.price.lookup_key = 'someone_else';
    await expect(syncSubscription('sub_1', syncDeps(otherPrice))).rejects.toMatchObject({
      code: 'P0002',
    });
  });
});
