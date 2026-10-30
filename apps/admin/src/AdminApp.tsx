import type { SupabaseClient } from '@supabase/supabase-js';
import { lazy, useMemo } from 'react';
import { Admin, CustomRoutes, Resource } from 'react-admin';
import { Route } from 'react-router-dom';
import { AbuseFlagList } from './abuse/AbuseFlagList';
import { AbuseFlagShow } from './abuse/AbuseFlagShow';
import { AdminLayout } from './AdminLayout';
import { adminDarkTheme, adminTheme } from './adminTheme';
import { createAuthProvider } from './authProvider';
import { Dashboard } from './Dashboard';
import { IncidentList } from './incidents/IncidentList';
import { IncidentShow } from './incidents/IncidentShow';
import { AdminSupabaseProvider } from './AdminSupabase';
import { BusinessList } from './businesses/BusinessList';
import { BusinessShow } from './businesses/BusinessShow';
import { createDataProvider } from './dataProvider';
import { createLoginPage } from './LoginPage';

// Pages with charts and tools only some staff use load when first opened.
const InsightsPage = lazy(async () => ({
  default: (await import('./insights/InsightsPage')).InsightsPage,
}));
const RetentionPage = lazy(async () => ({
  default: (await import('./retention/RetentionPage')).RetentionPage,
}));
const StaffPage = lazy(async () => ({ default: (await import('./staff/StaffPage')).StaffPage }));

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
        <Resource
          name="incidents"
          options={{ label: 'Incident review' }}
          list={IncidentList}
          show={IncidentShow}
        />
        <Resource
          name="abuse_flags"
          options={{ label: 'Abuse flags' }}
          list={AbuseFlagList}
          show={AbuseFlagShow}
        />
        <CustomRoutes>
          <Route path="/insights" element={<InsightsPage />} />
          <Route path="/retention" element={<RetentionPage />} />
          <Route path="/staff" element={<StaffPage />} />
        </CustomRoutes>
      </Admin>
    </AdminSupabaseProvider>
  );
}
