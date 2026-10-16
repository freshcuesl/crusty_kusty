import type { SupabaseClient } from '@supabase/supabase-js';
import { createContext, useContext, type ReactNode } from 'react';

const AdminSupabaseContext = createContext<SupabaseClient | null>(null);

/** Gives admin screens the Supabase client for storage and review actions. */
export function AdminSupabaseProvider({
  client,
  children,
}: {
  client: SupabaseClient;
  children: ReactNode;
}) {
  return <AdminSupabaseContext.Provider value={client}>{children}</AdminSupabaseContext.Provider>;
}

export function useAdminSupabase(): SupabaseClient {
  const client = useContext(AdminSupabaseContext);
  if (!client) throw new Error('useAdminSupabase must be used inside <AdminSupabaseProvider>');
  return client;
}
