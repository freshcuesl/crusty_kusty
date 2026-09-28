import { Button, Stack } from '@mui/material';
import { useAuth } from '../AuthProvider';
import { TotpEnroll } from '../TotpEnroll';
import { PageTitle } from '../ui';

export function MfaSetupPage() {
  const { refresh, signOut } = useAuth();

  return (
    <Stack spacing={2}>
      <PageTitle subtitle="Every account uses a code from an authenticator app, so a stolen password isn't enough to get in.">
        Turn on two-step login
      </PageTitle>
      <TotpEnroll
        friendlyName="Authenticator app"
        submitLabel="Turn on two-step login"
        onVerified={refresh}
      />
      <Button color="inherit" onClick={() => void signOut()}>
        Sign out
      </Button>
    </Stack>
  );
}
