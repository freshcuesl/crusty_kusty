import { Alert, Button, Link, Stack, TextField, Typography } from '@mui/material';
import { useState, type FormEvent } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router';
import { friendlyError } from '@cs/core';
import { unmetPasswordRules } from '../passwordPolicy';
import { readPendingInvite } from '../pendingInvite';
import { useSupabase } from '../SupabaseProvider';
import { FormError, PageTitle, PasswordField } from '../ui';

export function SignUpPage() {
  const supabase = useSupabase();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const cleanEmail = email.trim().toLowerCase();
    if (!name.trim() || !cleanEmail) {
      setError('Enter your name and email.');
      return;
    }
    if (unmetPasswordRules(password).length > 0) {
      setError(friendlyError({ code: 'weak_password' }));
      return;
    }
    setBusy(true);
    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: { full_name: name.trim() },
          emailRedirectTo: `${window.location.origin}/sign-in`,
        },
      });
      if (signUpError) {
        setError(friendlyError(signUpError));
        return;
      }
      navigate('/check-email', { state: { email: cleanEmail } });
    } catch (thrown) {
      setError(friendlyError(thrown));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate>
      <PageTitle subtitle="For business owners and their teams.">Create your account</PageTitle>
      <Stack spacing={2}>
        {readPendingInvite() && (
          <Alert severity="info" role="status">
            Use the same email address your team invite was sent to.
          </Alert>
        )}
        <FormError message={error} />
        <TextField
          label="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          fullWidth
        />
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
          autoComplete="new-password"
          showRules
        />
        <Button type="submit" variant="contained" size="large" loading={busy}>
          Create account
        </Button>
        <Typography variant="body2" color="text.secondary">
          Already have an account?{' '}
          <Link component={RouterLink} to="/sign-in">
            Sign in
          </Link>
        </Typography>
      </Stack>
    </form>
  );
}
