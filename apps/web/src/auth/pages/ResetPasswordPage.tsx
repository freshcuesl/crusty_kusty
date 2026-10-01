import { Alert, Button, Stack } from '@mui/material';
import { useState, type FormEvent } from 'react';
import { Link as RouterLink } from 'react-router';
import { friendlyError } from '@cs/core';
import { unmetPasswordRules } from '../passwordPolicy';
import { useSupabase } from '../SupabaseProvider';
import { FormError, PageTitle, PasswordField } from '../ui';

export function ResetPasswordPage() {
  const supabase = useSupabase();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (unmetPasswordRules(password).length > 0) {
      setError(friendlyError({ code: 'weak_password' }));
      return;
    }
    setBusy(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) setError(friendlyError(updateError));
      else setDone(true);
    } catch (thrown) {
      setError(friendlyError(thrown));
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <Stack spacing={2}>
        <PageTitle>Choose a new password</PageTitle>
        <Alert severity="success" role="status">
          Password updated. Use it next time you sign in.
        </Alert>
        <Button component={RouterLink} to="/" variant="contained">
          Continue
        </Button>
      </Stack>
    );
  }

  return (
    <form onSubmit={submit} noValidate>
      <PageTitle>Choose a new password</PageTitle>
      <Stack spacing={2}>
        <FormError message={error} />
        <PasswordField
          label="New password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          showRules
        />
        <Button type="submit" variant="contained" size="large" loading={busy}>
          Save password
        </Button>
      </Stack>
    </form>
  );
}
