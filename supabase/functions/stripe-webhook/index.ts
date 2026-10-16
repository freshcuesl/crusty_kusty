// Receives Stripe Identity results. Stripe signs every message; unsigned or forged
// requests are rejected. JWT verification is off for this function (see config.toml)
// because Stripe calls it, not a signed-in user.
import { getAdmin, getStripe, requireEnv, stripeCrypto } from '../_shared/clients.ts';
import { handleStripeWebhook, type StripeEventLike } from '../_shared/identity.ts';

Deno.serve((req) =>
  handleStripeWebhook(req, {
    async verifyEvent(rawBody, signature) {
      const event = await getStripe().webhooks.constructEventAsync(
        rawBody,
        signature,
        requireEnv('STRIPE_WEBHOOK_SECRET'),
        undefined,
        stripeCrypto,
      );
      return event as unknown as StripeEventLike;
    },

    async recordResult(sessionId, status, errorCode) {
      const { error } = await getAdmin().rpc('record_identity_result', {
        p_stripe_session_id: sessionId,
        p_status: status,
        p_error_code: errorCode,
      });
      if (error) throw error;
    },
  }),
);
