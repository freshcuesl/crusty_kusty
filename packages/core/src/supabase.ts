import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { parseEnv } from './env';

/** Creates a Supabase client from Vite env vars, with hardened auth settings. */
export function createSupabaseClient(env: Record<string, unknown>): SupabaseClient {
  const { supabaseUrl, supabaseAnonKey } = parseEnv(env);
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      // PKCE keeps auth codes useless to anyone who intercepts a redirect.
      flowType: 'pkce',
    },
  });
}
