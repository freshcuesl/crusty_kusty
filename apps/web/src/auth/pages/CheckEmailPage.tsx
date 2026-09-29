import MarkEmailReadOutlined from '@mui/icons-material/MarkEmailReadOutlined';
import { Button, Stack, Typography } from '@mui/material';
import { Link as RouterLink, useLocation } from 'react-router';
import { PageTitle } from '../ui';

export function CheckEmailPage() {
  const email = (useLocation().state as { email?: string } | null)?.email;

  return (
    <Stack spacing={2} sx={{ alignItems: 'flex-start' }}>
      <MarkEmailReadOutlined color="primary" sx={{ fontSize: 48 }} aria-hidden="true" />
      <PageTitle>Check your email</PageTitle>
      <Typography>
        We sent a confirmation link to {email ? <strong>{email}</strong> : 'your email address'}.
        Open it on this device to finish creating your account.
      </Typography>
      <Typography variant="body2" color="text.secondary">
        No email after a few minutes? Check your spam folder.
      </Typography>
      <Button component={RouterLink} to="/sign-in" variant="outlined">
        Back to sign in
      </Button>
    </Stack>
  );
}
