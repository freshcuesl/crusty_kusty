// Receives Stripe Identity results and billing (subscription) events. Stripe signs every message; unsigned or forged
// requests are rejected. JWT verification is off for this function (see config.toml)
// because Stripe calls it, not a signed-in user.
import { getAdmin, getStripe, requireEnv, stripeCrypto } from '../_shared/clients.ts';
import { syncSubscription, type SubscriptionLike } from '../_shared/billing.ts';
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

    syncSubscription: (subscriptionId) =>
      syncSubscription(subscriptionId, {
        async retrieve(id) {
          return (await getStripe().subscriptions.retrieve(id)) as unknown as SubscriptionLike;
        },
        async businessForCustomer(customerId) {
          const { data, error } = await getAdmin().rpc('business_for_stripe_customer', {
            p_customer_id: customerId,
          });
          if (error) throw error;
          return (data as string | null) ?? null;
        },
        async record(args) {
          const { error } = await getAdmin().rpc('record_subscription', args);
          if (error) throw error;
        },
      }),
  }),
);
