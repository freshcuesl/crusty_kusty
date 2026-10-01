import { Alert, Button, Snackbar } from '@mui/material';
import { useRegisterSW } from 'virtual:pwa-register/react';

/** Lets the user choose when to reload into a newly deployed version. */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  return (
    <Snackbar open={needRefresh} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
      <Alert
        role="status"
        severity="info"
        variant="filled"
        action={
          <>
            <Button color="inherit" size="small" onClick={() => setNeedRefresh(false)}>
              Later
            </Button>
            <Button color="inherit" size="small" onClick={() => void updateServiceWorker(true)}>
              Update now
            </Button>
          </>
        }
      >
        A new version of ClientShield is ready.
      </Alert>
    </Snackbar>
  );
}
