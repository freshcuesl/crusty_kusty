// Plans and payments with Stripe Billing: request handling logic.
// Pure TypeScript with injected dependencies, so it runs in Deno (Edge Functions)
// and in Vitest. The index.ts files wire in real Stripe and Supabase clients.

import { corsHeaders, json } from './http.ts';

export type PaidPlan = 'pro' | 'team';
export type Interval = 'month' | 'year';

const PAID_PLANS: readonly string[] = ['pro', 'team'];
const INTERVALS: readonly string[] = ['month', 'year'];

/** Stripe price lookup keys, created by `npm run stripe:setup-plans`. */
export function lookupKey(plan: PaidPlan, interval: Interval): string {
  return `clientshield_${plan}_${interval}`;
}

export function parseLookupKey(
  key: string | null | undefined,
): { tier: PaidPlan; interval: Interval } | null {
  const match = /^clientshield_(pro|team)_(month|year)$/.exec(key ?? '');
  return match ? { tier: match[1] as PaidPlan, interval: match[2] as Interval } : null;
}

/** Subscriptions that already pay (or are being paid): change them in the portal instead. */
const LIVE_STATUSES = ['active', 'trialing', 'past_due', 'unpaid', 'incomplete', 'paused'];

/** Stripe needs a trial end at least 48 hours away. */
const MIN_TRIAL_MS = 48 * 60 * 60 * 1000;

export interface Caller {
  userId: string;
  email: string;
  aal: string;
}

export interface BillingState {
  customerId: string | null;
  status: string;
  trialEndsAt: string | null;
}

export interface BillingDeps {
  /** Public origin of the web app; the only place Stripe may send people back to. */
  appUrl: string;
  now(): Date;
  /** Validates the caller's access token. Null when missing or invalid. */
  getCaller(authHeader: string | null): Promise<Caller | null>;
  getOwnerBusiness(userId: string): Promise<{ businessId: string; businessName: string } | null>;
  getBilling(businessId: string): Promise<BillingState>;
}

export interface CheckoutDeps extends BillingDeps {
  createCustomer(params: { businessId: string; name: string; email: string }): Promise<string>;
  saveCustomer(businessId: string, customerId: string): Promise<void>;
  /** The Stripe price id for a lookup key, or null when it hasn't been created. */
  findPrice(lookupKey: string): Promise<string | null>;
  createCheckoutSession(params: {
    customerId: string;
    priceId: string;
    businessId: string;
    /** Unix seconds; null charges straight away. */
    trialEnd: number | null;
    successUrl: string;
    cancelUrl: string;
  }): Promise<{ url: string }>;
}

export interface PortalDeps extends BillingDeps {
  createPortalSession(customerId: string, returnUrl: string): Promise<{ url: string }>;
}

type Guard =
  | { ok: true; caller: Caller; businessId: string; businessName: string }
  | { ok: false; response: Response };

/** Shared checks: POST from the app, signed-in owner with two-step login. */
async function guard(
  req: Request,
  deps: BillingDeps,
  cors: Record<string, string>,
): Promise<Guard> {
  if (req.method === 'OPTIONS') {
    return { ok: false, response: new Response(null, { status: 204, headers: cors }) };
  }
  if (req.method !== 'POST') {
    return { ok: false, response: json({ error: 'Method not allowed.' }, 405, cors) };
  }
  const caller = await deps.getCaller(req.headers.get('Authorization'));
  if (!caller) return { ok: false, response: json({ error: 'Sign in first.' }, 401, cors) };
  if (caller.aal !== 'aal2') {
    return { ok: false, response: json({ error: 'Two-step login required.' }, 403, cors) };
  }
  const business = await deps.getOwnerBusiness(caller.userId);
  if (!business) {
    return {
      ok: false,
      response: json({ error: 'Only the business owner can manage billing.' }, 403, cors),
    };
  }
  return { ok: true, caller, ...business };
}

async function readPlan(req: Request): Promise<{ plan: PaidPlan; interval: Interval } | null> {
  try {
    const body = (await req.json()) as { plan?: unknown; interval?: unknown };
    if (typeof body.plan !== 'string' || !PAID_PLANS.includes(body.plan)) return null;
    if (typeof body.interval !== 'string' || !INTERVALS.includes(body.interval)) return null;
    return { plan: body.plan as PaidPlan, interval: body.interval as Interval };
  } catch {
    return null;
  }
}

export async function handleCreateCheckout(req: Request, deps: CheckoutDeps): Promise<Response> {
  const cors = corsHeaders(deps.appUrl);
  try {
    const checked = await guard(req, deps, cors);
    if (!checked.ok) return checked.response;

    const choice = await readPlan(req);
    if (!choice) return json({ error: 'Choose Pro or Team, monthly or yearly.' }, 400, cors);

    const billing = await deps.getBilling(checked.businessId);
    if (LIVE_STATUSES.includes(billing.status)) {
      return json(
        { error: 'You already have a subscription. Use Manage billing to change it.' },
        409,
        cors,
      );
    }

    const priceId = await deps.findPrice(lookupKey(choice.plan, choice.interval));
    if (!priceId) {
      console.error('create-checkout-session: price not found. Run npm run stripe:setup-plans.');
      return json({ error: "Billing isn't set up yet. Try again later." }, 503, cors);
    }

    let customerId = billing.customerId;
    if (!customerId) {
      customerId = await deps.createCustomer({
        businessId: checked.businessId,
        name: checked.businessName,
        email: checked.caller.email,
      });
      await deps.saveCustomer(checked.businessId, customerId);
    }

    // Subscribing during the free trial keeps the remaining trial days.
    const trialEndMs = billing.trialEndsAt ? Date.parse(billing.trialEndsAt) : NaN;
    const trialEnd =
      trialEndMs - deps.now().getTime() >= MIN_TRIAL_MS ? Math.floor(trialEndMs / 1000) : null;

    // Built on the server: a request body can never redirect people elsewhere.
    const origin = new URL(deps.appUrl).origin;
    const session = await deps.createCheckoutSession({
      customerId,
      priceId,
      businessId: checked.businessId,
      trialEnd,
      successUrl: `${origin}/billing?checkout=success`,
      cancelUrl: `${origin}/billing`,
    });
    return json({ url: session.url }, 200, cors);
  } catch (error) {
    console.error('create-checkout-session failed', error);
    return json({ error: 'Could not open checkout. Try again in a moment.' }, 500, cors);
  }
}

export async function handleCreatePortal(req: Request, deps: PortalDeps): Promise<Response> {
  const cors = corsHeaders(deps.appUrl);
  try {
    const checked = await guard(req, deps, cors);
    if (!checked.ok) return checked.response;

    const billing = await deps.getBilling(checked.businessId);
    if (!billing.customerId) {
      return json({ error: 'Choose a plan first.' }, 409, cors);
    }
    const session = await deps.createPortalSession(
      billing.customerId,
      `${new URL(deps.appUrl).origin}/billing`,
    );
    return json({ url: session.url }, 200, cors);
  } catch (error) {
    console.error('create-billing-portal failed', error);
    return json({ error: 'Could not open billing. Try again in a moment.' }, 500, cors);
  }
}

// ---------------------------------------------------------------------------
// Webhook: copy subscription state into the database
// ---------------------------------------------------------------------------

/** The parts of a Stripe subscription we use. */
export interface SubscriptionLike {
  id: string;
  customer: string | { id: string };
  status: string;
  cancel_at_period_end: boolean;
  metadata?: Record<string, string> | null;
  /** Older Stripe API versions keep the period end on the subscription. */
  current_period_end?: number;
  items: {
    data: {
      current_period_end?: number;
      price: { lookup_key: string | null; recurring?: { interval: string } | null };
    }[];
  };
}

export interface RecordSubscriptionArgs {
  p_business_id: string;
  p_customer_id: string;
  p_subscription_id: string;
  p_tier: PaidPlan;
  p_status: string;
  p_interval: Interval;
  p_period_end: string | null;
  p_cancel_at_period_end: boolean;
}

export interface SyncDeps {
  retrieve(subscriptionId: string): Promise<SubscriptionLike>;
  businessForCustomer(customerId: string): Promise<string | null>;
  record(args: RecordSubscriptionArgs): Promise<void>;
}

function notOurs(message: string): Error {
  return Object.assign(new Error(message), { code: 'P0002' });
}

/**
 * Reads the subscription fresh from Stripe and saves it. Fetching (instead of
 * trusting the event body) means events arriving out of order can't save stale state.
 */
export async function syncSubscription(subscriptionId: string, deps: SyncDeps): Promise<void> {
  const sub = await deps.retrieve(subscriptionId);
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
  const item = sub.items.data[0];
  const plan = parseLookupKey(item?.price.lookup_key);
  if (!plan) throw notOurs('Not a ClientShield price');

  const businessId =
    sub.metadata?.business_id || (await deps.businessForCustomer(customerId)) || null;
  if (!businessId) throw notOurs('Unknown business');

  const periodEnd = item?.current_period_end ?? sub.current_period_end;
  await deps.record({
    p_business_id: businessId,
    p_customer_id: customerId,
    p_subscription_id: sub.id,
    p_tier: plan.tier,
    p_status: sub.status,
    p_interval: plan.interval,
    p_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    p_cancel_at_period_end: sub.cancel_at_period_end,
  });
}
