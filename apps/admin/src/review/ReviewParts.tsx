// Building blocks shared by the business and incident review pages.
import CheckCircleOutlined from '@mui/icons-material/CheckCircleOutlined';
import ErrorOutlined from '@mui/icons-material/ErrorOutlined';
import FingerprintOutlined from '@mui/icons-material/FingerprintOutlined';
import OpenInNewOutlined from '@mui/icons-material/OpenInNewOutlined';
import {
  Alert,
  Button,
  List,
  ListItem,
  ListItemText,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useState, type ReactNode } from 'react';
import { useNotify, useRefresh, type RaRecord } from 'react-admin';
import { friendlyError, sha256Hex } from '@cs/core';
import { useAdminSupabase } from '../AdminSupabase';

const SIGNED_URL_SECONDS = 300;

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Paper variant="outlined" sx={{ p: 2.5 }}>
      <Typography variant="h6" component="h3" sx={{ mb: 1.5 }}>
        {title}
      </Typography>
      {children}
    </Paper>
  );
}

type Check = 'checking' | 'match' | 'mismatch' | 'error';

interface FileRowProps {
  bucket: string;
  fileName: string;
  storagePath: string;
  sha256: string;
  kindLabel: string;
}

/** A stored file: open it through a 5-minute link, or check its fingerprint. */
export function FileRow({ bucket, fileName, storagePath, sha256, kindLabel }: FileRowProps) {
  const supabase = useAdminSupabase();
  const [check, setCheck] = useState<Check | null>(null);

  const open = async () => {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(storagePath, SIGNED_URL_SECONDS);
    if (!error && data) window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  };

  const verify = async () => {
    setCheck('checking');
    try {
      const { data, error } = await supabase.storage.from(bucket).download(storagePath);
      if (error || !data) throw error ?? new Error('Download failed');
      setCheck((await sha256Hex(data)) === sha256 ? 'match' : 'mismatch');
    } catch {
      setCheck('error');
    }
  };

  const status = { display: 'flex', gap: 0.5, alignItems: 'center', width: '100%' } as const;

  return (
    <ListItem disableGutters sx={{ flexWrap: 'wrap', gap: 1 }}>
      <ListItemText primary={fileName} secondary={kindLabel} />
      <Stack direction="row" spacing={1}>
        <Button
          size="small"
          startIcon={<OpenInNewOutlined />}
          aria-label={`Open ${fileName}`}
          onClick={() => void open()}
        >
          Open
        </Button>
        <Button
          size="small"
          startIcon={<FingerprintOutlined />}
          aria-label={`Check fingerprint of ${fileName}`}
          onClick={() => void verify()}
          loading={check === 'checking'}
        >
          Check
        </Button>
      </Stack>
      {check === 'match' && (
        <Typography variant="body2" sx={{ ...status, color: 'success.dark' }}>
          <CheckCircleOutlined fontSize="small" aria-hidden="true" />
          Unchanged since upload
        </Typography>
      )}
      {check === 'mismatch' && (
        <Typography variant="body2" sx={{ ...status, color: 'error.main' }}>
          <ErrorOutlined fontSize="small" aria-hidden="true" />
          Does not match the upload. Do not approve.
        </Typography>
      )}
      {check === 'error' && (
        <Typography variant="body2" color="error" sx={{ width: '100%' }}>
          Couldn't download the file to check it. Try again.
        </Typography>
      )}
    </ListItem>
  );
}

export function HistoryList({
  events,
  labels,
}: {
  events: RaRecord[];
  labels: Record<string, string>;
}) {
  return (
    <Section title="History">
      <List aria-label="History" dense>
        {events.map((event) => (
          <ListItem key={event.id} disableGutters>
            <ListItemText
              primary={labels[String(event.action)] ?? String(event.action)}
              secondary={[new Date(String(event.created_at)).toLocaleString(), event.note]
                .filter(Boolean)
                .join(' · ')}
            />
          </ListItem>
        ))}
      </List>
    </Section>
  );
}

export interface DecisionOption {
  value: string;
  label: string;
  variant: 'contained' | 'outlined';
  color?: 'error';
  requiresNote: boolean;
}

interface DecisionPanelProps {
  /** Database function that records the decision, e.g. review_business. */
  rpc: string;
  /** Extra arguments identifying the record, e.g. { p_business_id: id }. */
  target: Record<string, string>;
  options: DecisionOption[];
  noteLabel: string;
  /** Who reads the note, for the "note required" message. */
  audience: string;
  guidance: string;
}

export function DecisionPanel({
  rpc,
  target,
  options,
  noteLabel,
  audience,
  guidance,
}: DecisionPanelProps) {
  const supabase = useAdminSupabase();
  const refresh = useRefresh();
  const notify = useNotify();
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const decide = async (option: DecisionOption) => {
    setError(null);
    const cleanNote = note.trim();
    if (option.requiresNote && !cleanNote) {
      setError(`Add a note explaining the decision. The ${audience} will see it.`);
      return;
    }
    setBusy(option.value);
    try {
      const { error: rpcError } = await supabase.rpc(rpc, {
        ...target,
        p_decision: option.value,
        p_note: cleanNote || null,
      });
      if (rpcError) {
        setError(friendlyError(rpcError));
        return;
      }
      notify('Decision saved', { type: 'success' });
      refresh();
    } catch (thrown) {
      setError(friendlyError(thrown));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Section title="Decision">
      <Stack spacing={2}>
        <Typography variant="body2" color="text.secondary">
          {guidance}
        </Typography>
        {error && <Alert severity="error">{error}</Alert>}
        <TextField
          label={noteLabel}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          multiline
          minRows={2}
          helperText="Required to ask for more info or reject."
        />
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
          {options.map((option) => (
            <Button
              key={option.value}
              variant={option.variant}
              {...(option.color ? { color: option.color } : {})}
              onClick={() => void decide(option)}
              loading={busy === option.value}
            >
              {option.label}
            </Button>
          ))}
        </Stack>
      </Stack>
    </Section>
  );
}
