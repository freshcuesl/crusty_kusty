import { Alert, Button, Link, Stack, TextField } from '@mui/material';
import { useState, type FormEvent } from 'react';
import { Link as RouterLink } from 'react-router';
import { friendlyError } from '@cs/core';
import { readPendingInvite } from '../pendingInvite';
import { useSupabase } from '../SupabaseProvider';
import { FormError, PageTitle, PasswordField } from '../ui';

export function SignInPage() {
  const supabase = useSupabase();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setBusy(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (signInError) setError(friendlyError(signInError));
    } catch (thrown) {
      setError(friendlyError(thrown));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate>
      <PageTitle>Sign in</PageTitle>
      <Stack spacing={2}>
        {readPendingInvite() && (
          <Alert severity="info" role="status">
            Sign in to accept your team invite.
          </Alert>
        )}
        <FormError message={error} />
        <TextField
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          fullWidth
        />
        <PasswordField
          label="Password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
        />
        <Button type="submit" variant="contained" size="large" loading={busy}>
          Sign in
        </Button>
        <Stack direction="row" sx={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
          <Link component={RouterLink} to="/forgot-password">
            Forgot password?
          </Link>
          <Link component={RouterLink} to="/sign-up">
            Create an account
          </Link>
        </Stack>
      </Stack>
    </form>
  );
}
