import LockOutlined from '@mui/icons-material/LockOutlined';
import { Button, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import { Link as RouterLink } from 'react-router';
import { useAuth } from '../auth/AuthProvider';

/** Shows its children only to verified businesses; everyone else is pointed to verification. */
export function RequireVerified({ children }: { children: ReactNode }) {
  const { membership } = useAuth();
  if (membership?.verificationStatus === 'verified') return <>{children}</>;

  return (
    <Stack spacing={2} sx={{ alignItems: 'flex-start' }}>
      <LockOutlined color="primary" sx={{ fontSize: 48 }} aria-hidden="true" />
      <Typography variant="h4" component="h1">
        Verify your business first
      </Typography>
      <Typography color="text.secondary">
        Customer checks and incident reports are only open to verified businesses. This keeps the
        network trustworthy for everyone.
      </Typography>
      <Button component={RouterLink} to="/verification" variant="contained">
        Go to verification
      </Button>
    </Stack>
  );
}
