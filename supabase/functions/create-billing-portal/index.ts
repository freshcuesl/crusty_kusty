// Opens the Stripe billing portal: change plan, update the card, see invoices, cancel.
import { getStripe } from '../_shared/clients.ts';
import { handleCreatePortal } from '../_shared/billing.ts';
import { billingDeps } from '../_shared/billingClients.ts';

let configurationId: string | undefined;

/** The portal settings made by `npm run stripe:setup-plans` (they list our plans). */
async function portalConfiguration(): Promise<string | undefined> {
  if (configurationId) return configurationId;
  const list = await getStripe().billingPortal.configurations.list({ active: true, limit: 100 });
  configurationId = list.data.find((c) => c.metadata?.app === 'clientshield')?.id;
  return configurationId;
}

Deno.serve((req) =>
  handleCreatePortal(req, {
    ...billingDeps(),

    async createPortalSession(customerId, returnUrl) {
      const session = await getStripe().billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl,
        configuration: await portalConfiguration(),
      });
      return { url: session.url };
    },
  }),
);
