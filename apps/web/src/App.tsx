import { CssBaseline, ThemeProvider } from '@mui/material';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useMemo, type ComponentType } from 'react';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router';
import { createAppTheme } from '@cs/brand';
import { SecurityPage } from './account/SecurityPage';
import { TeamPage } from './account/TeamPage';
import { AuthProvider, useAuth } from './auth/AuthProvider';
import { Gate } from './auth/Gate';
import { CheckEmailPage } from './auth/pages/CheckEmailPage';
import { ForgotPasswordPage } from './auth/pages/ForgotPasswordPage';
import { InvitePage } from './auth/pages/InvitePage';
import { MfaSetupPage } from './auth/pages/MfaSetupPage';
import { MfaVerifyPage } from './auth/pages/MfaVerifyPage';
import { OnboardingPage } from './auth/pages/OnboardingPage';
import { ResetPasswordPage } from './auth/pages/ResetPasswordPage';
import { SignInPage } from './auth/pages/SignInPage';
import { SignUpPage } from './auth/pages/SignUpPage';
import { SupabaseProvider } from './auth/SupabaseProvider';
import { AuthLayout } from './auth/ui';
import { IncidentPage } from './incidents/IncidentPage';
import { MyIncidentsPage } from './incidents/MyIncidentsPage';
import { ReportIncidentPage } from './incidents/ReportIncidentPage';
import { LandingPage } from './landing/LandingPage';
import { AppShell } from './layout/AppShell';
import { getSupabase } from './lib/supabase';
import { ComingSoonPage } from './pages/ComingSoonPage';
import { ConfigErrorPage } from './pages/ConfigErrorPage';
import { HomePage } from './pages/HomePage';
import { NotFoundPage } from './pages/NotFoundPage';
import { UpdatePrompt } from './pwa/UpdatePrompt';
import { homeActions } from './routes';
import { useColorMode } from './theme/useColorMode';
import { RequireVerified } from './verification/RequireVerified';
import { VerificationPage } from './verification/VerificationPage';

/** Home actions that are built; the rest show a "coming soon" placeholder. */
const BUILT_PAGES: Record<string, ComponentType> = {
  '/incidents/new': ReportIncidentPage,
  '/incidents': MyIncidentsPage,
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
        {homeActions.map(({ path, label, needsVerification }) => {
          const Page = BUILT_PAGES[path];
          const page = Page ? <Page /> : <ComingSoonPage title={label} />;
          return (
            <Route
              key={path}
              path={path}
              element={needsVerification ? <RequireVerified>{page}</RequireVerified> : page}
            />
          );
        })}
        <Route path="/incidents/:id" element={<IncidentPage />} />
        <Route path="/verification" element={<VerificationPage />} />
        <Route path="/team" element={<TeamPage />} />
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
