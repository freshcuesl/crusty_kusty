import type { SupabaseClient } from '@supabase/supabase-js';
import { createContext, useContext, type ReactNode } from 'react';

const SupabaseContext = createContext<SupabaseClient | null>(null);

/** Supplies the Supabase client, so tests can swap in a fake. */
export function SupabaseProvider({
  client,
  children,
}: {
  client: SupabaseClient;
  children: ReactNode;
}) {
  return <SupabaseContext.Provider value={client}>{children}</SupabaseContext.Provider>;
}

export function useSupabase(): SupabaseClient {
  const client = useContext(SupabaseContext);
  if (!client) throw new Error('useSupabase must be used inside <SupabaseProvider>');
  return client;
}
