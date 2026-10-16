// Starts a Stripe Identity check (ID document + live selfie) for the signed-in business owner.
import { aalOf, getAdmin, getStripe, requireEnv } from '../_shared/clients.ts';
import { handleCreateSession } from '../_shared/identity.ts';

Deno.serve((req) =>
  handleCreateSession(req, {
    appUrl: requireEnv('APP_URL'),
    now: () => new Date(),

    async getCaller(authHeader) {
      const token = authHeader?.replace(/^Bearer\s+/i, '');
      if (!token) return null;
      const { data, error } = await getAdmin().auth.getUser(token);
      if (error || !data.user) return null;
      return { userId: data.user.id, aal: aalOf(token) };
    },

    async getOwnerBusinessId(userId) {
      const { data, error } = await getAdmin()
        .from('business_members')
        .select('business_id')
        .eq('user_id', userId)
        .eq('role', 'owner')
        .maybeSingle();
      if (error) throw error;
      return data?.business_id ?? null;
    },

    async isOwnerVerified(userId) {
      const { count, error } = await getAdmin()
        .from('owner_identity_checks')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', 'verified');
      if (error) throw error;
      return (count ?? 0) > 0;
    },

    async countSessionsSince(userId, sinceIso) {
      const { count, error } = await getAdmin()
        .from('owner_identity_checks')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', sinceIso);
      if (error) throw error;
      return count ?? 0;
    },

    async createStripeSession({ userId, businessId, returnUrl }) {
      const session = await getStripe().identity.verificationSessions.create({
        type: 'document',
        client_reference_id: userId,
        metadata: { user_id: userId, business_id: businessId },
        options: {
          document: {
            allowed_types: ['driving_license', 'passport', 'id_card'],
            require_live_capture: true,
            require_matching_selfie: true,
          },
        },
        return_url: returnUrl,
      });
      if (!session.url) throw new Error('Stripe returned no verification URL');
      return { id: session.id, url: session.url };
    },

    async recordSession(row) {
      const { error } = await getAdmin().from('owner_identity_checks').insert(row);
      if (error) throw error;
    },
  }),
);
