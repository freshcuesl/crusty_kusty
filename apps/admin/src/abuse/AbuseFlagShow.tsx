import { Alert, Box, Button, Link, Stack, TextField, Typography } from '@mui/material';
import { useState } from 'react';
import { Show, useGetOne, useNotify, useRecordContext, useRefresh } from 'react-admin';
import { friendlyError } from '@cs/core';
import { useAdminSupabase } from '../AdminSupabase';
import { Section } from '../review/ReviewParts';
import { FlagStatusChip } from './AbuseFlagList';
import { ABUSE_FLAGS, flagLabel, type AbuseFlagKind } from './labels';

function BusinessLink({ businessId }: { businessId: string }) {
  const { data } = useGetOne('businesses', { id: businessId });
  return (
    <Link href={`#/businesses/${businessId}/show`}>
      {data ? String(data.name) : 'Open business'}
    </Link>
  );
}

function ResolvePanel({ flagId }: { flagId: string }) {
  const supabase = useAdminSupabase();
  const refresh = useRefresh();
  const notify = useNotify();
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const resolve = async () => {
    setError(null);
    const cleanNote = note.trim();
    if (!cleanNote) {
      setError('Add a note explaining what you found. Other moderators will read it.');
      return;
    }
    setBusy(true);
    try {
      const { error: rpcError } = await supabase.rpc('resolve_abuse_flag', {
        p_flag_id: flagId,
        p_note: cleanNote,
      });
      if (rpcError) {
        setError(friendlyError(rpcError));
        return;
      }
      notify('Flag resolved', { type: 'success' });
      refresh();
    } catch (thrown) {
      setError(friendlyError(thrown));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section title="Resolve">
      <Stack spacing={2}>
        <Typography variant="body2" color="text.secondary">
          Look into the business&apos;s recent activity, contact the owner if needed, then record
          what you found. If the same pattern continues, a new flag opens.
        </Typography>
        {error && <Alert severity="error">{error}</Alert>}
        <TextField
          label="What you found"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          multiline
          minRows={2}
        />
        <Box>
          <Button variant="contained" onClick={() => void resolve()} loading={busy}>
            Resolve flag
          </Button>
        </Box>
      </Stack>
    </Section>
  );
}

function FlagLayout() {
  const record = useRecordContext();
  if (!record) return null;
  const meaning = ABUSE_FLAGS[record.kind as AbuseFlagKind];
  return (
    <Stack spacing={2} sx={{ p: 2 }}>
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Typography variant="h5" component="h2">
            {flagLabel(record.kind)}
          </Typography>
          <FlagStatusChip record={record} />
        </Box>
        <Typography color="text.secondary">
          Business: <BusinessLink businessId={String(record.business_id)} />
        </Typography>
      </Box>
      <Section title="What was noticed">
        <Stack spacing={1}>
          <Typography>{String(record.detail)}</Typography>
          <Typography variant="body2" color="text.secondary">
            Raised {new Date(String(record.created_at)).toLocaleString()}
          </Typography>
          {meaning && <Alert severity="info">{meaning.lookFor}</Alert>}
        </Stack>
      </Section>
      {record.resolved_at ? (
        <Section title="Resolution">
          <Typography sx={{ whiteSpace: 'pre-wrap' }}>{String(record.resolution_note)}</Typography>
          <Typography variant="body2" color="text.secondary">
            Resolved {new Date(String(record.resolved_at)).toLocaleString()}
          </Typography>
        </Section>
      ) : (
        <ResolvePanel flagId={String(record.id)} />
      )}
    </Stack>
  );
}

export function AbuseFlagShow() {
  return (
    <Show title="Abuse flag">
      <FlagLayout />
    </Show>
  );
}
