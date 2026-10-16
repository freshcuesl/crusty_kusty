// Real clients for the Edge Functions (Deno). Secrets come from `supabase secrets set`;
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase automatically.
import Stripe from 'npm:stripe@23';
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

export function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing secret: ${name}`);
  return value;
}

let stripe: Stripe | undefined;
export function getStripe(): Stripe {
  stripe ??= new Stripe(requireEnv('STRIPE_SECRET_KEY'), {
    httpClient: Stripe.createFetchHttpClient(),
  });
  return stripe;
}

export const stripeCrypto = Stripe.createSubtleCryptoProvider();

let admin: SupabaseClient | undefined;
/** Service-role client: bypasses row-level security. Server code only. */
export function getAdmin(): SupabaseClient {
  admin ??= createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return admin;
}

/** Reads the `aal` claim of a token that the auth server has already validated. */
export function aalOf(token: string): string {
  try {
    const payload = token.split('.')[1] ?? '';
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return String(JSON.parse(json).aal ?? 'aal1');
  } catch {
    return 'aal1';
  }
}
