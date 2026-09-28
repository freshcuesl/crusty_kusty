import { CssBaseline, ThemeProvider } from '@mui/material';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useMemo } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router';
import { createAppTheme } from '@ck/brand';
import { SecurityPage } from './account/SecurityPage';
import { TeamPage } from './account/TeamPage';
import { AuthProvider } from './auth/AuthProvider';
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
import { AppShell } from './layout/AppShell';
import { getSupabase } from './lib/supabase';
import { ComingSoonPage } from './pages/ComingSoonPage';
import { ConfigErrorPage } from './pages/ConfigErrorPage';
import { HomePage } from './pages/HomePage';
import { NotFoundPage } from './pages/NotFoundPage';
import { UpdatePrompt } from './pwa/UpdatePrompt';
import { homeActions } from './routes';
import { useColorMode } from './theme/useColorMode';

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

      <Route
        element={
          <Gate allow={['ready']} rememberAsDestination>
            <AppShell />
          </Gate>
        }
      >
        <Route index element={<HomePage />} />
        {homeActions.map(({ path, label }) => (
          <Route key={path} path={path} element={<ComingSoonPage title={label} />} />
        ))}
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
