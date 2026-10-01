import { Alert, Button, Link, Stack, TextField } from '@mui/material';
import { useState, type FormEvent } from 'react';
import { Link as RouterLink } from 'react-router';
import { friendlyError } from '@cs/core';
import { useSupabase } from '../SupabaseProvider';
import { FormError, PageTitle } from '../ui';

export function ForgotPasswordPage() {
  const supabase = useSupabase();
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setError('Enter your email.');
      return;
    }
    setBusy(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      // Only rate limits are shown. Anything else gets the same answer, so this
      // page can't be used to find out which emails have accounts.
      if (resetError?.code?.startsWith('over_')) {
        setError(friendlyError(resetError));
        return;
      }
      setSentTo(cleanEmail);
    } catch (thrown) {
      setError(friendlyError(thrown));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate>
      <PageTitle subtitle="We'll email you a link to choose a new password.">
        Reset your password
      </PageTitle>
      <Stack spacing={2}>
        <FormError message={error} />
        {sentTo && (
          <Alert severity="success" role="status">
            If an account exists for {sentTo}, a reset link is on its way.
          </Alert>
        )}
        <TextField
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          fullWidth
        />
        <Button type="submit" variant="contained" size="large" loading={busy}>
          Send reset link
        </Button>
        <Link component={RouterLink} to="/sign-in">
          Back to sign in
        </Link>
      </Stack>
    </form>
  );
}
