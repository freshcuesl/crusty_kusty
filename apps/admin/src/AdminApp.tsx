import type { SupabaseClient } from '@supabase/supabase-js';
import { useMemo } from 'react';
import { Admin, Resource } from 'react-admin';
import { AdminLayout } from './AdminLayout';
import { adminDarkTheme, adminTheme } from './adminTheme';
import { createAuthProvider } from './authProvider';
import { Dashboard } from './Dashboard';
import { AdminSupabaseProvider } from './AdminSupabase';
import { BusinessList } from './businesses/BusinessList';
import { BusinessShow } from './businesses/BusinessShow';
import { createDataProvider } from './dataProvider';
import { createLoginPage } from './LoginPage';

export function AdminApp({ supabase }: { supabase: SupabaseClient }) {
  const authProvider = useMemo(() => createAuthProvider(supabase), [supabase]);
  const LoginPage = useMemo(() => createLoginPage(supabase), [supabase]);
  const dataProvider = useMemo(() => createDataProvider(supabase), [supabase]);

  return (
    <AdminSupabaseProvider client={supabase}>
      <Admin
        title="ClientShield Admin"
        authProvider={authProvider}
        loginPage={LoginPage}
        // No `requireAuth`: in react-admin 5.15 it loops forever for signed-out
        // visitors (blank page). Pages still check sign-in and redirect, and the
        // database enforces moderator access regardless of the screen.
        dataProvider={dataProvider}
        dashboard={Dashboard}
        layout={AdminLayout}
        theme={adminTheme}
        darkTheme={adminDarkTheme}
        disableTelemetry
      >
        <Resource
          name="businesses"
          options={{ label: 'Business verifications' }}
          list={BusinessList}
          show={BusinessShow}
          recordRepresentation="name"
        />
      </Admin>
    </AdminSupabaseProvider>
  );
}
