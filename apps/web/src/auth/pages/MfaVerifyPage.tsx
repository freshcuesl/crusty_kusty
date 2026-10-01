import {
  Button,
  FormControl,
  FormControlLabel,
  FormLabel,
  Radio,
  RadioGroup,
  Stack,
  Typography,
} from '@mui/material';
import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../AuthProvider';
import { friendlyError } from '@cs/core';
import { useSupabase } from '../SupabaseProvider';
import { CodeField, FormError, FullPageSpinner, PageTitle } from '../ui';
import { isSixDigits } from '../a11y';

interface Device {
  id: string;
  name: string;
}

export function MfaVerifyPage() {
  const supabase = useSupabase();
  const { refresh, signOut } = useAuth();
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [factorId, setFactorId] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const { data } = await supabase.auth.mfa.listFactors();
        const verified = (data?.totp ?? []).map((f, i) => ({
          id: f.id,
          name: f.friendly_name || `Authenticator ${i + 1}`,
        }));
        setDevices(verified);
        setFactorId(verified[0]?.id ?? '');
      } catch (thrown) {
        setDevices([]);
        setError(friendlyError(thrown));
      }
    })();
  }, [supabase]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!isSixDigits(code)) {
      setError('Enter the 6-digit code from your authenticator app.');
      return;
    }
    setBusy(true);
    try {
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
      if (verifyError) {
        setError(friendlyError(verifyError));
        setCode('');
        return;
      }
      await refresh();
    } catch (thrown) {
      setError(friendlyError(thrown));
    } finally {
      setBusy(false);
    }
  };

  if (!devices) return <FullPageSpinner />;

  return (
    <form onSubmit={submit} noValidate>
      <PageTitle subtitle="Open your authenticator app and enter the code for ClientShield.">
        Enter your code
      </PageTitle>
      <Stack spacing={2}>
        <FormError message={error} />
        {devices.length > 1 && (
          <FormControl>
            <FormLabel id="device-label">Which device?</FormLabel>
            <RadioGroup
              aria-labelledby="device-label"
              value={factorId}
              onChange={(e) => setFactorId(e.target.value)}
            >
              {devices.map((d) => (
                <FormControlLabel key={d.id} value={d.id} control={<Radio />} label={d.name} />
              ))}
            </RadioGroup>
          </FormControl>
        )}
        <CodeField value={code} onChange={setCode} />
        <Button type="submit" variant="contained" size="large" loading={busy}>
          Verify
        </Button>
        <Typography variant="body2" color="text.secondary">
          Lost your phone? Use your backup authenticator. No backup? Contact support to verify your
          identity.
        </Typography>
        <Button color="inherit" onClick={() => void signOut()}>
          Sign out
        </Button>
      </Stack>
    </form>
  );
}
