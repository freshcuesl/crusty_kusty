import { CssBaseline, ThemeProvider } from '@mui/material';
import type { SupabaseClient } from '@supabase/supabase-js';
import { lazy, Suspense, useMemo, type ComponentType } from 'react';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router';
import { createAppTheme } from '@cs/brand';
import { AuthProvider, useAuth } from './auth/AuthProvider';
import { Gate } from './auth/Gate';
import { SupabaseProvider } from './auth/SupabaseProvider';
import { AuthLayout, FullPageSpinner } from './auth/ui';
import { AppShell } from './layout/AppShell';
import { getSupabase } from './lib/supabase';
import { ConfigErrorPage } from './pages/ConfigErrorPage';
import { HomePage } from './pages/HomePage';
import { NotFoundPage } from './pages/NotFoundPage';
import { UpdatePrompt } from './pwa/UpdatePrompt';
import { homeActions } from './routes';
import { useColorMode } from './theme/useColorMode';
import { RequireVerified } from './verification/RequireVerified';

// Pages load when first visited, so the landing page and sign-in download only what
// they need. A spinner shows for the moment a page takes to arrive.
function lazyPage<K extends string>(load: () => Promise<Record<K, ComponentType>>, name: K) {
  const Page = lazy(async () => ({ default: (await load())[name] as ComponentType }));
  return function LazyPage() {
    return (
      <Suspense fallback={<FullPageSpinner />}>
        <Page />
      </Suspense>
    );
  };
}

const SecurityPage = lazyPage(() => import('./account/SecurityPage'), 'SecurityPage');
const TeamPage = lazyPage(() => import('./account/TeamPage'), 'TeamPage');
const CheckEmailPage = lazyPage(() => import('./auth/pages/CheckEmailPage'), 'CheckEmailPage');
const ForgotPasswordPage = lazyPage(
  () => import('./auth/pages/ForgotPasswordPage'),
  'ForgotPasswordPage',
);
const InvitePage = lazyPage(() => import('./auth/pages/InvitePage'), 'InvitePage');
const MfaSetupPage = lazyPage(() => import('./auth/pages/MfaSetupPage'), 'MfaSetupPage');
const MfaVerifyPage = lazyPage(() => import('./auth/pages/MfaVerifyPage'), 'MfaVerifyPage');
const OnboardingPage = lazyPage(() => import('./auth/pages/OnboardingPage'), 'OnboardingPage');
const ResetPasswordPage = lazyPage(
  () => import('./auth/pages/ResetPasswordPage'),
  'ResetPasswordPage',
);
const SignInPage = lazyPage(() => import('./auth/pages/SignInPage'), 'SignInPage');
const SignUpPage = lazyPage(() => import('./auth/pages/SignUpPage'), 'SignUpPage');
const BillingPage = lazyPage(() => import('./billing/BillingPage'), 'BillingPage');
const CustomerPage = lazyPage(() => import('./customers/CustomerPage'), 'CustomerPage');
const CustomersPage = lazyPage(() => import('./customers/CustomersPage'), 'CustomersPage');
const IncidentPage = lazyPage(() => import('./incidents/IncidentPage'), 'IncidentPage');
const MyIncidentsPage = lazyPage(() => import('./incidents/MyIncidentsPage'), 'MyIncidentsPage');
const ReportIncidentPage = lazyPage(
  () => import('./incidents/ReportIncidentPage'),
  'ReportIncidentPage',
);
const LandingPage = lazyPage(() => import('./landing/LandingPage'), 'LandingPage');
const VerificationPage = lazyPage(
  () => import('./verification/VerificationPage'),
  'VerificationPage',
);
const AlertDetailPage = lazyPage(() => import('./matching/AlertPages'), 'AlertDetailPage');
const AlertsPage = lazyPage(() => import('./matching/AlertPages'), 'AlertsPage');
const CustomerCheckPage = lazyPage(() => import('./matching/CheckPages'), 'CustomerCheckPage');
const NewCustomerPage = lazyPage(() => import('./matching/CheckPages'), 'NewCustomerPage');

/** The page behind each home-screen action. */
const ACTION_PAGES: Record<string, ComponentType> = {
  '/incidents/new': ReportIncidentPage,
  '/incidents': MyIncidentsPage,
  '/customers/new': NewCustomerPage,
  '/check': CustomerCheckPage,
  '/alerts': AlertsPage,
  '/customers': CustomersPage,
};

/**
 * Signed-out visitors at "/" see the public landing page. Every other app page,
 * and "/" for members, goes through the usual sign-in gate.
 */
function HomeOrLanding() {
  const { step } = useAuth();
  const { pathname } = useLocation();
  if (step === 'signed-out' && pathname === '/') return <LandingPage />;
  return (
    <Gate allow={['ready']} rememberAsDestination>
      <AppShell />
    </Gate>
  );
}

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AuthLayout />}>
        <Route
          path="/sign-in"
          element={
            <Gate allow={['signed-out']}>
              <SignInPage />
            </Gate>
          }
        />
        <Route
          path="/sign-up"
          element={
            <Gate allow={['signed-out']}>
              <SignUpPage />
            </Gate>
          }
        />
        <Route
          path="/check-email"
          element={
            <Gate allow={['signed-out']}>
              <CheckEmailPage />
            </Gate>
          }
        />
        <Route
          path="/forgot-password"
          element={
            <Gate allow={['signed-out']}>
              <ForgotPasswordPage />
            </Gate>
          }
        />
        <Route
          path="/reset-password"
          element={
            <Gate allow={['ready', 'onboarding']} rememberAsDestination>
              <ResetPasswordPage />
            </Gate>
          }
        />
        <Route
          path="/mfa/setup"
          element={
            <Gate allow={['mfa-setup']}>
              <MfaSetupPage />
            </Gate>
          }
        />
        <Route
          path="/mfa/verify"
          element={
            <Gate allow={['mfa-verify']}>
              <MfaVerifyPage />
            </Gate>
          }
        />
        <Route
          path="/onboarding"
          element={
            <Gate allow={['onboarding']}>
              <OnboardingPage />
            </Gate>
          }
        />
        <Route path="/invite/:token" element={<InvitePage />} />
      </Route>

      <Route element={<HomeOrLanding />}>
        <Route index element={<HomePage />} />
        {homeActions.map(({ path, needsVerification }) => {
          const Page = ACTION_PAGES[path] ?? NotFoundPage;
          const page = <Page />;
          return (
            <Route
              key={path}
              path={path}
              element={needsVerification ? <RequireVerified>{page}</RequireVerified> : page}
            />
          );
        })}
        <Route path="/incidents/:id" element={<IncidentPage />} />
        <Route path="/customers/:id" element={<CustomerPage />} />
        <Route path="/alerts/:id" element={<AlertDetailPage />} />
        <Route path="/verification" element={<VerificationPage />} />
        <Route path="/team" element={<TeamPage />} />
        <Route path="/billing" element={<BillingPage />} />
        <Route path="/account/security" element={<SecurityPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

function connect(): SupabaseClient | Error {
  try {
    return getSupabase();
  } catch (error) {
    return error instanceof Error ? error : new Error(String(error));
  }
}

export function App() {
  const mode = useColorMode();
  const theme = useMemo(() => createAppTheme(mode), [mode]);
  const client = useMemo(() => connect(), []);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline enableColorScheme />
      {/* Registers the service worker on every page, including sign-in, so the app installs and works offline. */}
      <UpdatePrompt />
      {client instanceof Error ? (
        <ConfigErrorPage message={client.message} />
      ) : (
        <SupabaseProvider client={client}>
          <AuthProvider>
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </AuthProvider>
        </SupabaseProvider>
      )}
    </ThemeProvider>
  );
}
