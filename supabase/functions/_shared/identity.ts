// Owner identity verification with Stripe Identity: request handling logic.
// Pure TypeScript with injected dependencies, so it runs in Deno (Edge Functions)
// and in Vitest. The index.ts files wire in real Stripe and Supabase clients.

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

function corsHeaders(appUrl: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': new URL(appUrl).origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

function json(body: unknown, status: number, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

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
  data: { object: { id: string; last_error?: { code?: string | null } | null } };
}

export interface WebhookDeps {
  /** Checks Stripe's signature and parses the event. Throws if the signature is wrong. */
  verifyEvent(rawBody: string, signature: string): Promise<StripeEventLike>;
  recordResult(sessionId: string, status: IdentityStatus, errorCode: string | null): Promise<void>;
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

  const status = EVENT_STATUS[event.type];
  if (!status) return json({ received: true }, 200);

  const session = event.data.object;
  try {
    await deps.recordResult(session.id, status, session.last_error?.code ?? null);
  } catch (error) {
    if ((error as { code?: string }).code === 'P0002') {
      // Not one of ours (for example a session from another environment). Don't retry.
      console.warn('stripe-webhook: unknown identity session', session.id);
      return json({ received: true }, 200);
    }
    console.error('stripe-webhook: could not save result', error);
    return json({ error: 'Could not save result.' }, 500);
  }

  return json({ received: true }, 200);
}
