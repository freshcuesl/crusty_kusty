// Real dependencies shared by the billing Edge Functions.
import { aalOf, getAdmin, requireEnv } from './clients.ts';
import type { BillingDeps, BillingState, Caller } from './billing.ts';

async function getCaller(authHeader: string | null): Promise<Caller | null> {
  const token = authHeader?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const { data, error } = await getAdmin().auth.getUser(token);
  if (error || !data.user) return null;
  return { userId: data.user.id, email: data.user.email ?? '', aal: aalOf(token) };
}

async function getOwnerBusiness(userId: string) {
  const { data, error } = await getAdmin()
    .from('business_members')
    .select('business_id, businesses(name)')
    .eq('user_id', userId)
    .eq('role', 'owner')
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const business = data.businesses as unknown as { name: string } | null;
  return { businessId: data.business_id as string, businessName: business?.name ?? '' };
}

async function getBilling(businessId: string): Promise<BillingState> {
  const { data, error } = await getAdmin()
    .from('subscriptions')
    .select('stripe_customer_id, status, trial_ends_at')
    .eq('business_id', businessId)
    .maybeSingle();
  if (error) throw error;
  return {
    customerId: data?.stripe_customer_id ?? null,
    status: data?.status ?? 'none',
    trialEndsAt: data?.trial_ends_at ?? null,
  };
}

export function billingDeps(): BillingDeps {
  return {
    appUrl: requireEnv('APP_URL'),
    now: () => new Date(),
    getCaller,
    getOwnerBusiness,
    getBilling,
  };
}
