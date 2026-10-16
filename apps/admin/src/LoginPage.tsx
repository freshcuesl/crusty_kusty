import {
  Alert,
  Box,
  Button,
  Container,
  Paper,
  Stack,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useState, type FormEvent } from 'react';
import { useLogin } from 'react-admin';
import { Logo } from '@cs/brand';
import { friendlyError } from '@cs/core';
import { ADMIN_MESSAGES } from './authProvider';

type Step = 'password' | 'code';

/** Two-step admin sign-in: password, then authenticator code, then role check. */
export function createLoginPage(supabase: SupabaseClient) {
  return function LoginPage() {
    const login = useLogin();
    const onDark = useTheme().palette.mode === 'dark';
    const [step, setStep] = useState<Step>('password');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [code, setCode] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const run = async (work: () => Promise<void>) => {
      setError(null);
      setBusy(true);
      try {
        await work();
      } catch (thrown) {
        setError(
          thrown instanceof Error && thrown.message ? thrown.message : friendlyError(thrown),
        );
      } finally {
        setBusy(false);
      }
    };

    const submitPassword = (event: FormEvent) => {
      event.preventDefault();
      void run(async () => {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });
        if (signInError) throw new Error(friendlyError(signInError));

        const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (aal?.nextLevel !== 'aal2') {
          await supabase.auth.signOut();
          throw new Error(ADMIN_MESSAGES['needs-mfa-setup']);
        }
        setStep('code');
      });
    };

    const submitCode = (event: FormEvent) => {
      event.preventDefault();
      void run(async () => {
        if (!/^\d{6}$/.test(code)) throw new Error('Enter the 6-digit code from your app.');
        const { data } = await supabase.auth.mfa.listFactors();
        const factor = data?.totp[0];
        if (!factor) throw new Error(ADMIN_MESSAGES['needs-mfa-setup']);

        const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
          factorId: factor.id,
          code,
        });
        if (verifyError) throw new Error(friendlyError(verifyError));
        await login({});
      });
    };

    return (
      <Box
        component="main"
        sx={{
          minHeight: '100dvh',
          display: 'grid',
          placeItems: 'center',
          bgcolor: 'background.default',
        }}
      >
        <Container maxWidth="xs">
          <Stack spacing={3} sx={{ alignItems: 'center' }}>
            <Logo size={56} withWordmark onDark={onDark} />
            <Paper variant="outlined" sx={{ p: 4, width: '100%', borderRadius: 4 }}>
              <Typography variant="h5" component="h1" sx={{ mb: 3 }}>
                Admin sign in
              </Typography>
              {step === 'password' ? (
                <form onSubmit={submitPassword} noValidate>
                  <Stack spacing={2}>
                    {error && <Alert severity="error">{error}</Alert>}
                    <TextField
                      label="Email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                    <TextField
                      label="Password"
                      type="password"
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <Button type="submit" variant="contained" size="large" loading={busy}>
                      Continue
                    </Button>
                  </Stack>
                </form>
              ) : (
                <form onSubmit={submitCode} noValidate>
                  <Stack spacing={2}>
                    {error && <Alert severity="error">{error}</Alert>}
                    <TextField
                      label="6-digit code"
                      autoComplete="one-time-code"
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\s/g, ''))}
                      slotProps={{ htmlInput: { inputMode: 'numeric', maxLength: 6 } }}
                    />
                    <Button type="submit" variant="contained" size="large" loading={busy}>
                      Verify
                    </Button>
                  </Stack>
                </form>
              )}
            </Paper>
          </Stack>
        </Container>
      </Box>
    );
  };
}
