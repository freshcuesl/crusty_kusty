import ContentCopy from '@mui/icons-material/ContentCopy';
import PersonRemoveOutlined from '@mui/icons-material/PersonRemoveOutlined';
import {
  Alert,
  Box,
  Button,
  Chip,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { friendlyError } from '@ck/core';
import { useSupabase } from '../auth/SupabaseProvider';
import { FormError } from '../auth/ui';
import { ConfirmDialog } from './ConfirmDialog';

interface TeamMember {
  user_id: string;
  full_name: string;
  email: string;
  role: 'owner' | 'staff';
}

interface PendingInvite {
  id: string;
  email: string;
  expires_at: string;
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

async function fetchTeam(
  supabase: SupabaseClient,
  includeInvites: boolean,
): Promise<{ members: TeamMember[]; invites: PendingInvite[] }> {
  const { data, error } = await supabase.rpc('team_members');
  if (error) throw error;
  if (!includeInvites) return { members: (data as TeamMember[] | null) ?? [], invites: [] };

  const { data: rows, error: invitesError } = await supabase
    .from('business_invites')
    .select('id, email, expires_at')
    .is('accepted_at', null)
    .order('created_at');
  if (invitesError) throw invitesError;
  return {
    members: (data as TeamMember[] | null) ?? [],
    invites: (rows as PendingInvite[] | null) ?? [],
  };
}

export function TeamPage() {
  const supabase = useSupabase();
  const { membership } = useAuth();
  const isOwner = membership?.role === 'owner';

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [inviteLink, setInviteLink] = useState<{ url: string; email: string } | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [copied, setCopied] = useState(false);

  const [removing, setRemoving] = useState<TeamMember | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);

  const load = useCallback(
    () =>
      fetchTeam(supabase, isOwner).then(
        (team) => {
          setMembers(team.members);
          setInvites(team.invites);
        },
        (thrown: unknown) => setLoadError(friendlyError(thrown)),
      ),
    [supabase, isOwner],
  );

  useEffect(() => {
    let active = true;
    fetchTeam(supabase, isOwner).then(
      (team) => {
        if (!active) return;
        setMembers(team.members);
        setInvites(team.invites);
      },
      (thrown: unknown) => active && setLoadError(friendlyError(thrown)),
    );
    return () => {
      active = false;
    };
  }, [supabase, isOwner]);

  const invite = async (event: FormEvent) => {
    event.preventDefault();
    if (!membership) return;
    setInviteError(null);
    setInviteLink(null);
    setCopied(false);
    setInviting(true);
    try {
      const cleanEmail = email.trim().toLowerCase();
      const { data, error } = await supabase.rpc('create_invite', {
        p_business_id: membership.businessId,
        p_email: cleanEmail,
      });
      if (error) {
        setInviteError(friendlyError(error));
        return;
      }
      setInviteLink({
        url: `${window.location.origin}/invite/${data as string}`,
        email: cleanEmail,
      });
      setEmail('');
      await load();
    } catch (thrown) {
      setInviteError(friendlyError(thrown));
    } finally {
      setInviting(false);
    }
  };

  const copy = async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink.url);
      setCopied(true);
    } catch {
      setInviteError('Copy failed. Press and hold the link to copy it instead.');
    }
  };

  const cancelInvite = async (id: string) => {
    await supabase.from('business_invites').delete().eq('id', id);
    await load();
  };

  const confirmRemove = async () => {
    if (!removing) return;
    setRemoveBusy(true);
    try {
      const { error } = await supabase.rpc('remove_member', { p_user_id: removing.user_id });
      if (error) setLoadError(friendlyError(error));
      setRemoving(null);
      await load();
    } finally {
      setRemoveBusy(false);
    }
  };

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h4" component="h1">
          Team
        </Typography>
        <Typography color="text.secondary">{membership?.businessName}</Typography>
      </Box>

      <FormError message={loadError} />

      <Paper variant="outlined">
        <List aria-label="Team members">
          {members.map((m) => {
            const name = m.full_name || m.email;
            return (
              <ListItem
                key={m.user_id}
                secondaryAction={
                  isOwner && m.role !== 'owner' ? (
                    <IconButton aria-label={`Remove ${name}`} onClick={() => setRemoving(m)}>
                      <PersonRemoveOutlined />
                    </IconButton>
                  ) : undefined
                }
              >
                <ListItemText
                  primary={name}
                  secondary={m.full_name ? m.email : undefined}
                  slotProps={{ primary: { sx: { fontWeight: 600 } } }}
                />
                <Chip
                  size="small"
                  label={m.role === 'owner' ? 'Owner' : 'Staff'}
                  sx={{ mr: isOwner && m.role !== 'owner' ? 5 : 0 }}
                />
              </ListItem>
            );
          })}
        </List>
      </Paper>

      {isOwner && (
        <>
          <form onSubmit={invite} noValidate>
            <Stack spacing={2}>
              <Typography variant="h6" component="h2">
                Invite staff
              </Typography>
              <Typography variant="body2" color="text.secondary">
                They'll create their own account and set up two-step login before joining.
              </Typography>
              <FormError message={inviteError} />
              <TextField
                label="Their email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="off"
                fullWidth
              />
              <Button type="submit" variant="contained" loading={inviting}>
                Create invite link
              </Button>
            </Stack>
          </form>

          {inviteLink && (
            <Alert
              severity="success"
              role="status"
              sx={{ '& .MuiAlert-message': { width: '100%' } }}
            >
              <Stack spacing={1.5}>
                <Typography variant="body2">
                  Send this link to them by text or email. It works once, for {inviteLink.email},
                  for 7 days.
                </Typography>
                <TextField
                  value={inviteLink.url}
                  size="small"
                  fullWidth
                  slotProps={{ htmlInput: { readOnly: true, 'aria-label': 'Invite link' } }}
                  onFocus={(e) => e.target.select()}
                />
                <Button
                  onClick={() => void copy()}
                  startIcon={<ContentCopy />}
                  variant="outlined"
                  color="inherit"
                >
                  {copied ? 'Copied' : 'Copy link'}
                </Button>
              </Stack>
            </Alert>
          )}

          {invites.length > 0 && (
            <Stack spacing={1}>
              <Typography variant="h6" component="h2">
                Pending invites
              </Typography>
              <Paper variant="outlined">
                <List aria-label="Pending invites">
                  {invites.map((inv) => {
                    const expired = new Date(inv.expires_at) < new Date();
                    return (
                      <ListItem
                        key={inv.id}
                        secondaryAction={
                          <Button
                            color="inherit"
                            aria-label={`Cancel invite for ${inv.email}`}
                            onClick={() => void cancelInvite(inv.id)}
                          >
                            Cancel
                          </Button>
                        }
                      >
                        <ListItemText
                          primary={inv.email}
                          secondary={expired ? 'Expired' : `Expires ${formatDate(inv.expires_at)}`}
                        />
                      </ListItem>
                    );
                  })}
                </List>
              </Paper>
            </Stack>
          )}
        </>
      )}

      <ConfirmDialog
        open={removing !== null}
        title="Remove from team?"
        body={`${removing?.full_name || removing?.email} will lose access to ${membership?.businessName} right away.`}
        confirmLabel="Remove"
        busy={removeBusy}
        onConfirm={() => void confirmRemove()}
        onCancel={() => setRemoving(null)}
      />
    </Stack>
  );
}
