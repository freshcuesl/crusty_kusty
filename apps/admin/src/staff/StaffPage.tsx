import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Title, useGetIdentity, useNotify } from 'react-admin';
import { friendlyError } from '@cs/core';
import { useAdminSupabase } from '../AdminSupabase';

type Role = 'moderator' | 'admin';

interface StaffMember {
  user_id: string;
  email: string;
  role: Role;
  granted_at: string;
}

const ROLE_LABELS: Record<Role, string> = { moderator: 'Moderator', admin: 'Admin' };

/** Admins add, change and remove ClientShield staff. */
export function StaffPage() {
  const supabase = useAdminSupabase();
  const notify = useNotify();
  const { identity } = useGetIdentity();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('moderator');
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<StaffMember | null>(null);

  const load = useCallback(
    () =>
      supabase.rpc('staff_members').then(({ data, error }) => {
        if (error) setLoadError(friendlyError(error));
        else setStaff((data as StaffMember[] | null) ?? []);
      }),
    [supabase],
  );
  useEffect(() => {
    void load();
  }, [load]);

  const run = async (call: () => PromiseLike<{ error: unknown }>, done: string) => {
    setBusy(true);
    setFormError(null);
    try {
      const { error } = await call();
      if (error) {
        setFormError(friendlyError(error));
        return false;
      }
      notify(done, { type: 'success' });
      await load();
      return true;
    } catch (thrown) {
      setFormError(friendlyError(thrown));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const add = async (event: FormEvent) => {
    event.preventDefault();
    const clean = email.trim();
    if (!clean) {
      setFormError('Enter their email.');
      return;
    }
    const ok = await run(
      () => supabase.rpc('add_staff_member', { p_email: clean, p_role: role }),
      'Staff updated',
    );
    if (ok) setEmail('');
  };

  return (
    <Stack spacing={3} sx={{ py: 3, maxWidth: 900 }}>
      <Title title="Staff" />
      <Box>
        <Typography variant="h4" component="h1">
          Staff
        </Typography>
        <Typography color="text.secondary">
          Moderators review businesses, incidents and abuse flags. Admins can also change retention,
          see finances and manage staff.
        </Typography>
      </Box>

      {loadError && <Alert severity="error">{loadError}</Alert>}

      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
        <Typography variant="h6" component="h2" sx={{ mb: 1 }}>
          Add someone
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          They need a ClientShield account with two-step login first. Ask them to sign up in the
          app, then add the email they used.
        </Typography>
        <Stack
          component="form"
          onSubmit={add}
          noValidate
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          sx={{ alignItems: { sm: 'flex-start' } }}
        >
          <TextField
            label="Their ClientShield email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            sx={{ flex: 1 }}
          />
          <TextField
            select
            label="Role"
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            sx={{ minWidth: 160 }}
          >
            <MenuItem value="moderator">Moderator</MenuItem>
            <MenuItem value="admin">Admin</MenuItem>
          </TextField>
          <Button type="submit" variant="contained" loading={busy} sx={{ height: 56 }}>
            Add to staff
          </Button>
        </Stack>
        {formError && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {formError}
          </Alert>
        )}
      </Paper>

      <Paper variant="outlined">
        <Table aria-label="Staff">
          <TableHead>
            <TableRow>
              <TableCell>Email</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Since</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {staff.map((member) => (
              <TableRow key={member.user_id}>
                <TableCell>{member.email}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={ROLE_LABELS[member.role]}
                    color={member.role === 'admin' ? 'primary' : 'default'}
                  />
                </TableCell>
                <TableCell>{new Date(member.granted_at).toLocaleDateString()}</TableCell>
                <TableCell align="right">
                  {member.user_id !== identity?.id && (
                    <Button
                      color="error"
                      size="small"
                      aria-label={`Remove ${member.email}`}
                      onClick={() => setRemoving(member)}
                    >
                      Remove
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Dialog
        open={removing !== null}
        onClose={() => setRemoving(null)}
        aria-labelledby="remove-staff-title"
      >
        <DialogTitle id="remove-staff-title">Remove {removing?.email}?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            They lose access to the admin panel straight away. Their ClientShield account stays.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRemoving(null)} color="inherit">
            Cancel
          </Button>
          <Button
            color="error"
            variant="contained"
            loading={busy}
            onClick={async () => {
              const target = removing;
              if (!target) return;
              await run(
                () => supabase.rpc('remove_staff_member', { p_user_id: target.user_id }),
                'Removed from staff',
              );
              setRemoving(null);
            }}
          >
            Remove
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
