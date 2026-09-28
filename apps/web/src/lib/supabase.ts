import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { parseEnv } from '../config/env';

let client: SupabaseClient | undefined;

/**
 * The app's single Supabase client. Created on first use so a missing config
 * shows a clear error instead of crashing at import time.
 */
export function getSupabase(): SupabaseClient {
  if (!client) {
    const { supabaseUrl, supabaseAnonKey } = parseEnv(import.meta.env);
    client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        // PKCE keeps auth codes useless to anyone who intercepts a redirect.
        flowType: 'pkce',
      },
    });
  }
  return client;
}
