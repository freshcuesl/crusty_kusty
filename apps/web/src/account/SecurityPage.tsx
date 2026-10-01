import DeleteOutlined from '@mui/icons-material/DeleteOutlined';
import PhonelinkLockOutlined from '@mui/icons-material/PhonelinkLockOutlined';
import {
  Alert,
  Box,
  Button,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useCallback, useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router';
import { useAuth } from '../auth/AuthProvider';
import { friendlyError } from '@cs/core';
import { useSupabase } from '../auth/SupabaseProvider';
import { TotpEnroll } from '../auth/TotpEnroll';
import { FormError } from '../auth/ui';
import { ConfirmDialog } from './ConfirmDialog';

interface Device {
  id: string;
  name: string;
  addedOn?: string;
}

/** Picks "Backup authenticator N" that isn't already taken; names must be unique. */
function nextBackupName(devices: Device[]): string {
  const taken = new Set(devices.map((d) => d.name));
  let n = devices.length + 1;
  while (taken.has(`Backup authenticator ${n}`)) n += 1;
  return `Backup authenticator ${n}`;
}

async function fetchDevices(supabase: SupabaseClient): Promise<Device[]> {
  const { data } = await supabase.auth.mfa.listFactors();
  return (data?.totp ?? []).map((f, i) => ({
    id: f.id,
    name: f.friendly_name || `Authenticator ${i + 1}`,
    ...(f.created_at ? { addedOn: new Date(f.created_at).toLocaleDateString() } : {}),
  }));
}

export function SecurityPage() {
  const supabase = useSupabase();
  const { refresh } = useAuth();
  const [devices, setDevices] = useState<Device[]>([]);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<Device | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    () =>
      fetchDevices(supabase).then(setDevices, (thrown: unknown) => setError(friendlyError(thrown))),
    [supabase],
  );

  useEffect(() => {
    let active = true;
    fetchDevices(supabase).then(
      (list) => active && setDevices(list),
      (thrown: unknown) => active && setError(friendlyError(thrown)),
    );
    return () => {
      active = false;
    };
  }, [supabase]);

  const confirmRemove = async () => {
    if (!removing) return;
    setRemoveBusy(true);
    try {
      const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId: removing.id });
      if (unenrollError) setError(friendlyError(unenrollError));
      setRemoving(null);
      await load();
      await refresh();
    } finally {
      setRemoveBusy(false);
    }
  };

  const canRemove = devices.length > 1;

  return (
    <Stack spacing={3}>
      <Typography variant="h4" component="h1">
        Security
      </Typography>
      <FormError message={error} />

      <Stack spacing={1}>
        <Typography variant="h6" component="h2">
          Two-step login devices
        </Typography>
        <Paper variant="outlined">
          <List aria-label="Authenticator devices">
            {devices.map((d) => (
              <ListItem
                key={d.id}
                secondaryAction={
                  canRemove ? (
                    <IconButton aria-label={`Remove ${d.name}`} onClick={() => setRemoving(d)}>
                      <DeleteOutlined />
                    </IconButton>
                  ) : undefined
                }
              >
                <ListItemIcon>
                  <PhonelinkLockOutlined aria-hidden="true" />
                </ListItemIcon>
                <ListItemText
                  primary={d.name}
                  secondary={d.addedOn ? `Added ${d.addedOn}` : undefined}
                />
              </ListItem>
            ))}
          </List>
        </Paper>
        {devices.length === 1 && (
          <Alert severity="warning" role="status">
            Add a backup authenticator, such as a second phone or a password manager. If you lose
            your only device, you'll need support to get back in.
          </Alert>
        )}
      </Stack>

      {adding ? (
        <Paper variant="outlined" sx={{ p: 2.5 }}>
          <Typography variant="h6" component="h2" sx={{ mb: 2 }}>
            Add backup authenticator
          </Typography>
          <TotpEnroll
            friendlyName={nextBackupName(devices)}
            submitLabel="Save backup"
            onVerified={async () => {
              setAdding(false);
              await load();
            }}
          />
          <Button color="inherit" onClick={() => setAdding(false)} sx={{ mt: 1 }}>
            Cancel
          </Button>
        </Paper>
      ) : (
        <Button variant="outlined" onClick={() => setAdding(true)}>
          Add backup authenticator
        </Button>
      )}

      <Box>
        <Typography variant="h6" component="h2" sx={{ mb: 1 }}>
          Password
        </Typography>
        <Button component={RouterLink} to="/reset-password" variant="outlined">
          Change password
        </Button>
      </Box>

      <ConfirmDialog
        open={removing !== null}
        title="Remove this device?"
        body={`Codes from ${removing?.name} will stop working for your account.`}
        confirmLabel="Remove"
        busy={removeBusy}
        onConfirm={() => void confirmRemove()}
        onCancel={() => setRemoving(null)}
      />
    </Stack>
  );
}
