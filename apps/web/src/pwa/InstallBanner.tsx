import IosShareIcon from '@mui/icons-material/IosShare';
import { Button, Paper, Stack, Typography } from '@mui/material';
import { useState } from 'react';
import { Logo } from '@cs/brand';
import { useInstallPrompt } from './useInstallPrompt';

const DISMISS_KEY = 'cs.installBanner.dismissed';

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

function saveDismissed() {
  try {
    localStorage.setItem(DISMISS_KEY, '1');
  } catch {
    // Storage blocked (private browsing). Hiding for this visit is enough.
  }
}

/** Invites the user to add ClientShield to their home screen. */
export function InstallBanner() {
  const { canInstall, isInstalled, platform, promptInstall } = useInstallPrompt();
  const [dismissed, setDismissed] = useState(readDismissed);

  const showIosSteps = platform === 'ios';
  if (isInstalled || dismissed || (!canInstall && !showIosSteps)) return null;

  const dismiss = () => {
    saveDismissed();
    setDismissed(true);
  };

  return (
    <Paper
      component="section"
      aria-label="Install the app"
      variant="outlined"
      sx={{ p: 2, borderRadius: 3 }}
    >
      <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
        <Logo size={44} decorative />
        <Stack sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle1" component="h2" sx={{ fontWeight: 600 }}>
            Get the app
          </Typography>
          {showIosSteps ? (
            <Typography variant="body2" color="text.secondary">
              Tap{' '}
              <IosShareIcon fontSize="inherit" aria-label="Share" sx={{ verticalAlign: '-2px' }} />{' '}
              Share, then Add to Home Screen.
            </Typography>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Add ClientShield to your home screen for quick checks on the job.
            </Typography>
          )}
        </Stack>
      </Stack>
      <Stack direction="row" spacing={1} sx={{ mt: 2, justifyContent: 'flex-end' }}>
        <Button onClick={dismiss} color="inherit">
          Not now
        </Button>
        {!showIosSteps && (
          <Button variant="contained" onClick={() => void promptInstall()}>
            Install app
          </Button>
        )}
      </Stack>
    </Paper>
  );
}
