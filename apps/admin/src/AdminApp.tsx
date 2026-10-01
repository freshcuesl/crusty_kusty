import type { SupabaseClient } from '@supabase/supabase-js';
import { useMemo } from 'react';
import { Admin, Resource } from 'react-admin';
import { AdminLayout } from './AdminLayout';
import { adminDarkTheme, adminTheme } from './adminTheme';
import { createAuthProvider } from './authProvider';
import { Dashboard } from './Dashboard';
import { dataProvider } from './dataProvider';
import { createLoginPage } from './LoginPage';

export function AdminApp({ supabase }: { supabase: SupabaseClient }) {
  const authProvider = useMemo(() => createAuthProvider(supabase), [supabase]);
  const LoginPage = useMemo(() => createLoginPage(supabase), [supabase]);

  return (
    <Admin
      title="ClientShield Admin"
      authProvider={authProvider}
      loginPage={LoginPage}
      requireAuth
      dataProvider={dataProvider}
      dashboard={Dashboard}
      layout={AdminLayout}
      theme={adminTheme}
      darkTheme={adminDarkTheme}
      disableTelemetry
    >
      {/* Screens for each resource arrive with the verification branch. */}
      <Resource name="businesses" options={{ label: 'Business verifications' }} />
    </Admin>
  );
}
