// Opens Stripe Checkout so a business owner can subscribe to Pro or Team.
import { getAdmin, getStripe } from '../_shared/clients.ts';
import { handleCreateCheckout } from '../_shared/billing.ts';
import { billingDeps } from '../_shared/billingClients.ts';

Deno.serve((req) =>
  handleCreateCheckout(req, {
    ...billingDeps(),

    async createCustomer({ businessId, name, email }) {
      const customer = await getStripe().customers.create({
        name,
        email: email || undefined,
        metadata: { business_id: businessId },
      });
      return customer.id;
    },

    async saveCustomer(businessId, customerId) {
      const { error } = await getAdmin().rpc('set_stripe_customer', {
        p_business_id: businessId,
        p_customer_id: customerId,
      });
      if (error) throw error;
    },

    async findPrice(lookupKey) {
      const prices = await getStripe().prices.list({ lookup_keys: [lookupKey], active: true });
      return prices.data[0]?.id ?? null;
    },

    async createCheckoutSession({
      customerId,
      priceId,
      businessId,
      trialEnd,
      successUrl,
      cancelUrl,
    }) {
      const session = await getStripe().checkout.sessions.create({
        mode: 'subscription',
        customer: customerId,
        client_reference_id: businessId,
        line_items: [{ price: priceId, quantity: 1 }],
        subscription_data: {
          metadata: { business_id: businessId },
          ...(trialEnd ? { trial_end: trialEnd } : {}),
        },
        allow_promotion_codes: true,
        success_url: successUrl,
        cancel_url: cancelUrl,
      });
      if (!session.url) throw new Error('Stripe returned no checkout URL');
      return { url: session.url };
    },
  }),
);
