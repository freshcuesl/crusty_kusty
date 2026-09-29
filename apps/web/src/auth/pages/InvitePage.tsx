import { Button, Stack, Typography } from '@mui/material';
import { useEffect } from 'react';
import { Navigate, Link as RouterLink, useParams } from 'react-router';
import { useAuth } from '../AuthProvider';
import { pathForStep } from '../authStep';
import { clearPendingInvite, savePendingInvite } from '../pendingInvite';
import { FullPageSpinner, PageTitle } from '../ui';

/**
 * Landing page for /invite/:token. Remembers the invite, then sends the person
 * through sign-up/sign-in and two-step login; onboarding offers "Join the team".
 */
export function InvitePage() {
  const { token } = useParams();
  const { step, membership } = useAuth();
  // Runs in the same commit as <Navigate>, so the token is saved before the redirect lands.
  useEffect(() => {
    if (step === 'ready') clearPendingInvite();
    else if (token && step !== 'loading') savePendingInvite(token);
  }, [token, step]);

  if (step === 'loading') return <FullPageSpinner />;

  if (step === 'ready') {
    return (
      <Stack spacing={2}>
        <PageTitle>Team invite</PageTitle>
        <Typography>
          You already belong to {membership?.businessName}. Each account can be part of one
          business.
        </Typography>
        <Button component={RouterLink} to="/" variant="contained">
          Go to home
        </Button>
      </Stack>
    );
  }

  return <Navigate to={step === 'signed-out' ? '/sign-up' : pathForStep(step)} replace />;
}
