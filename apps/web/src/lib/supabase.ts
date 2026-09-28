import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseClient } from '@ck/core';

let client: SupabaseClient | undefined;

/**
 * The app's single Supabase client. Created on first use so a missing config
 * shows a clear error instead of crashing at import time.
 */
export function getSupabase(): SupabaseClient {
  client ??= createSupabaseClient(import.meta.env);
  return client;
}
