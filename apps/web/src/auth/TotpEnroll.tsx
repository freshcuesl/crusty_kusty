import { Box, Button, CircularProgress, Stack, Typography } from '@mui/material';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { friendlyError } from '@ck/core';
import { useSupabase } from './SupabaseProvider';
import { CodeField, FormError } from './ui';
import { isSixDigits } from './a11y';

interface Enrollment {
  factorId: string;
  qrCode: string;
  secret: string;
}

interface TotpEnrollProps {
  friendlyName: string;
  submitLabel: string;
  onVerified: () => void | Promise<void>;
}

/**
 * Registers a new authenticator app: shows its QR code and key, then confirms it
 * with a 6-digit code. Shared by first-time setup and adding a backup device.
 */
export function TotpEnroll({ friendlyName, submitLabel, onVerified }: TotpEnrollProps) {
  const supabase = useSupabase();
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    // Enrolling twice would leave an orphaned factor, so guard against double effects.
    if (started.current) return;
    started.current = true;

    void (async () => {
      try {
        const { data: factors } = await supabase.auth.mfa.listFactors();
        const unfinished = (factors?.all ?? []).filter(
          (f) => f.factor_type === 'totp' && f.status === 'unverified',
        );
        for (const factor of unfinished) {
          await supabase.auth.mfa.unenroll({ factorId: factor.id });
        }

        const { data, error: enrollError } = await supabase.auth.mfa.enroll({
          factorType: 'totp',
          friendlyName,
        });
        if (enrollError || !data) {
          setError(friendlyError(enrollError));
          return;
        }
        setEnrollment({ factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret });
      } catch (thrown) {
        setError(friendlyError(thrown));
      }
    })();
  }, [supabase, friendlyName]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!enrollment) return;
    if (!isSixDigits(code)) {
      setError('Enter the 6-digit code from your authenticator app.');
      return;
    }
    setBusy(true);
    try {
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
        factorId: enrollment.factorId,
        code,
      });
      if (verifyError) {
        setError(friendlyError(verifyError));
        return;
      }
      await onVerified();
    } catch (thrown) {
      setError(friendlyError(thrown));
    } finally {
      setBusy(false);
    }
  };

  if (!enrollment) {
    return error ? (
      <FormError message={error} />
    ) : (
      <Box sx={{ display: 'grid', placeItems: 'center', py: 4 }}>
        <CircularProgress aria-label="Preparing your QR code" />
      </Box>
    );
  }

  return (
    <form onSubmit={submit} noValidate>
      <Stack spacing={2}>
        <Typography component="ol" sx={{ pl: 2.5, m: 0, '& li': { mb: 1 } }}>
          <li>
            Install an authenticator app, such as Google Authenticator, Microsoft Authenticator or
            1Password.
          </li>
          <li>In the app, add an account and scan this code.</li>
          <li>Type the 6-digit code the app shows.</li>
        </Typography>
        <Box
          sx={{
            alignSelf: 'center',
            p: 1.5,
            bgcolor: '#fff',
            borderRadius: 2,
            border: 1,
            borderColor: 'divider',
          }}
        >
          <img
            src={enrollment.qrCode}
            alt="QR code for your authenticator app"
            width={184}
            height={184}
            style={{ display: 'block' }}
          />
        </Box>
        <Typography variant="body2" color="text.secondary">
          Can't scan? Enter this key in the app instead:
        </Typography>
        <Typography
          component="code"
          sx={{
            fontFamily: 'monospace',
            fontSize: 16,
            wordBreak: 'break-all',
            p: 1,
            bgcolor: 'action.hover',
            borderRadius: 1,
            userSelect: 'all',
          }}
        >
          {enrollment.secret}
        </Typography>
        <FormError message={error} />
        <CodeField value={code} onChange={setCode} />
        <Button type="submit" variant="contained" size="large" loading={busy}>
          {submitLabel}
        </Button>
      </Stack>
    </form>
  );
}
