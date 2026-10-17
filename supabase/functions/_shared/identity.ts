// Owner identity verification with Stripe Identity, and the Stripe webhook
// (identity results and billing events): request handling logic.
// Pure TypeScript with injected dependencies, so it runs in Deno (Edge Functions)
// and in Vitest. The index.ts files wire in real Stripe and Supabase clients.

import { corsHeaders, json } from './http.ts';

export type IdentityStatus = 'requires_input' | 'processing' | 'verified' | 'canceled';

export interface CreateSessionDeps {
  /** Public origin of the web app; the only place Stripe may send people back to. */
  appUrl: string;
  now(): Date;
  /** Validates the caller's access token. Null when missing or invalid. */
  getCaller(authHeader: string | null): Promise<{ userId: string; aal: string } | null>;
  getOwnerBusinessId(userId: string): Promise<string | null>;
  isOwnerVerified(userId: string): Promise<boolean>;
  countSessionsSince(userId: string, sinceIso: string): Promise<number>;
  createStripeSession(params: {
    userId: string;
    businessId: string;
    returnUrl: string;
  }): Promise<{ id: string; url: string }>;
  recordSession(row: {
    business_id: string;
    user_id: string;
    stripe_session_id: string;
    status: IdentityStatus;
  }): Promise<void>;
}

const MAX_SESSIONS_PER_DAY = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

export async function handleCreateSession(
  req: Request,
  deps: CreateSessionDeps,
): Promise<Response> {
  const cors = corsHeaders(deps.appUrl);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405, cors);

  try {
    const caller = await deps.getCaller(req.headers.get('Authorization'));
    if (!caller) return json({ error: 'Sign in first.' }, 401, cors);
    if (caller.aal !== 'aal2') return json({ error: 'Two-step login required.' }, 403, cors);

    const businessId = await deps.getOwnerBusinessId(caller.userId);
    if (!businessId) {
      return json({ error: 'Only the business owner can verify identity.' }, 403, cors);
    }
    if (await deps.isOwnerVerified(caller.userId)) {
      return json({ error: 'Your identity is already verified.' }, 409, cors);
    }

    const since = new Date(deps.now().getTime() - DAY_MS).toISOString();
    if ((await deps.countSessionsSince(caller.userId, since)) >= MAX_SESSIONS_PER_DAY) {
      return json({ error: 'Too many attempts today. Try again tomorrow.' }, 429, cors);
    }

    // Built on the server: a request body can never redirect people elsewhere.
    const returnUrl = `${new URL(deps.appUrl).origin}/verification?identity=returned`;
    const session = await deps.createStripeSession({
      userId: caller.userId,
      businessId,
      returnUrl,
    });
    await deps.recordSession({
      business_id: businessId,
      user_id: caller.userId,
      stripe_session_id: session.id,
      status: 'requires_input',
    });

    return json({ url: session.url }, 200, cors);
  } catch (error) {
    console.error('create-identity-session failed', error);
    return json(
      { error: 'Could not start identity verification. Try again in a moment.' },
      500,
      cors,
    );
  }
}

// ---------------------------------------------------------------------------
// Webhook
// ---------------------------------------------------------------------------

export interface StripeEventLike {
  type: string;
  data: {
    object: {
      id: string;
      last_error?: { code?: string | null } | null;
      /** Checkout sessions: "subscription" for plan purchases, and the new subscription's id. */
      mode?: string;
      subscription?: string | null;
    };
  };
}

export interface WebhookDeps {
  /** Checks Stripe's signature and parses the event. Throws if the signature is wrong. */
  verifyEvent(rawBody: string, signature: string): Promise<StripeEventLike>;
  recordResult(sessionId: string, status: IdentityStatus, errorCode: string | null): Promise<void>;
  /** Copies a subscription's current state from Stripe (see billing.ts). */
  syncSubscription(subscriptionId: string): Promise<void>;
}

const SUBSCRIPTION_EVENTS = [
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
];

/** The subscription an event is about, if it is a billing event we handle. */
function subscriptionIdOf(event: StripeEventLike): string | null {
  const object = event.data.object;
  if (SUBSCRIPTION_EVENTS.includes(event.type)) return object.id;
  if (event.type === 'checkout.session.completed' && object.mode === 'subscription') {
    return object.subscription ?? null;
  }
  return null;
}

const EVENT_STATUS: Record<string, IdentityStatus> = {
  'identity.verification_session.verified': 'verified',
  'identity.verification_session.requires_input': 'requires_input',
  'identity.verification_session.processing': 'processing',
  'identity.verification_session.canceled': 'canceled',
};

export async function handleStripeWebhook(req: Request, deps: WebhookDeps): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  const signature = req.headers.get('Stripe-Signature');
  if (!signature) return json({ error: 'Missing signature.' }, 400);

  let event: StripeEventLike;
  try {
    event = await deps.verifyEvent(await req.text(), signature);
  } catch {
    return json({ error: 'Invalid signature.' }, 400);
  }

  const subscriptionId = subscriptionIdOf(event);
  const status = EVENT_STATUS[event.type];
  if (!subscriptionId && !status) return json({ received: true }, 200);

  try {
    if (subscriptionId) {
      await deps.syncSubscription(subscriptionId);
    } else if (status) {
      const session = event.data.object;
      await deps.recordResult(session.id, status, session.last_error?.code ?? null);
    }
  } catch (error) {
    if ((error as { code?: string }).code === 'P0002') {
      // Not one of ours (for example from another environment). Don't retry.
      console.warn('stripe-webhook: not ours', event.type, event.data.object.id);
      return json({ received: true }, 200);
    }
    console.error('stripe-webhook: could not save result', error);
    return json({ error: 'Could not save result.' }, 500);
  }

  return json({ received: true }, 200);
}
