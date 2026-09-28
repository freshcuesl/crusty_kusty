import GroupAddOutlined from '@mui/icons-material/GroupAddOutlined';
import { Alert, Button, Divider, Stack, TextField, Typography } from '@mui/material';
import { useState, type FormEvent } from 'react';
import { useAuth } from '../AuthProvider';
import { friendlyError } from '@ck/core';
import { clearPendingInvite, readPendingInvite } from '../pendingInvite';
import { useSupabase } from '../SupabaseProvider';
import { FormError, PageTitle } from '../ui';

export function OnboardingPage() {
  const supabase = useSupabase();
  const { refresh, signOut } = useAuth();
  const [invite, setInvite] = useState(readPendingInvite);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const join = async () => {
    if (!invite) return;
    setInviteError(null);
    setJoining(true);
    try {
      const { error: rpcError } = await supabase.rpc('accept_invite', { p_token: invite });
      if (rpcError) {
        setInviteError(friendlyError(rpcError));
        return;
      }
      clearPendingInvite();
      await refresh();
    } catch (thrown) {
      setInviteError(friendlyError(thrown));
    } finally {
      setJoining(false);
    }
  };

  const forgetInvite = () => {
    clearPendingInvite();
    setInvite(null);
    setInviteError(null);
  };

  const create = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setCreating(true);
    try {
      const { error: rpcError } = await supabase.rpc('create_business', { p_name: name });
      if (rpcError) {
        setError(friendlyError(rpcError));
        return;
      }
      await refresh();
    } catch (thrown) {
      setError(friendlyError(thrown));
    } finally {
      setCreating(false);
    }
  };

  return (
    <Stack spacing={3}>
      <PageTitle>Set up your business</PageTitle>

      {invite && (
        <Stack spacing={1.5}>
          <Alert severity="info" role="status" icon={<GroupAddOutlined />}>
            You opened a team invite link.
          </Alert>
          <FormError message={inviteError} />
          <Button variant="contained" size="large" onClick={() => void join()} loading={joining}>
            Join the team
          </Button>
          {inviteError && (
            <Button color="inherit" onClick={forgetInvite}>
              Forget this invite
            </Button>
          )}
          <Divider>or</Divider>
        </Stack>
      )}

      <form onSubmit={create} noValidate>
        <Stack spacing={2}>
          <Typography>Starting fresh? Add your business. We'll verify it next.</Typography>
          <FormError message={error} />
          <TextField
            label="Business name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="organization"
            fullWidth
          />
          <Button
            type="submit"
            variant={invite ? 'outlined' : 'contained'}
            size="large"
            loading={creating}
          >
            Create business
          </Button>
        </Stack>
      </form>

      <Typography variant="body2" color="text.secondary">
        Joining an existing team? Ask the owner to send you an invite link, then open it on this
        device.
      </Typography>
      <Button color="inherit" onClick={() => void signOut()}>
        Sign out
      </Button>
    </Stack>
  );
}
