import CheckCircleOutlined from '@mui/icons-material/CheckCircleOutlined';
import ErrorOutlined from '@mui/icons-material/ErrorOutlined';
import FingerprintOutlined from '@mui/icons-material/FingerprintOutlined';
import OpenInNewOutlined from '@mui/icons-material/OpenInNewOutlined';
import {
  Alert,
  Box,
  Button,
  List,
  ListItem,
  ListItemText,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import {
  Show,
  useGetManyReference,
  useNotify,
  useRecordContext,
  useRefresh,
  type RaRecord,
} from 'react-admin';
import { formatUsPhone, friendlyError, sha256Hex } from '@cs/core';
import { useAdminSupabase } from '../AdminSupabase';
import { StatusChip } from './BusinessList';
import { DOCUMENT_LABELS, EVENT_LABELS } from './labels';

const BUCKET = 'business-documents';
const SIGNED_URL_SECONDS = 300;

interface DocumentRecord extends RaRecord {
  kind: string;
  file_name: string;
  storage_path: string;
  sha256: string;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Paper variant="outlined" sx={{ p: 2.5 }}>
      <Typography variant="h6" component="h3" sx={{ mb: 1.5 }}>
        {title}
      </Typography>
      {children}
    </Paper>
  );
}

function Details({ record }: { record: RaRecord }) {
  const address = [
    record.address_line1,
    record.address_line2,
    [record.city, record.state].filter(Boolean).join(', '),
    record.postal_code,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <Section title="Business details">
      <Stack spacing={0.5}>
        <Typography>
          {record.phone ? formatUsPhone(String(record.phone)) : 'No phone yet'}
        </Typography>
        <Typography>{address || 'No address yet'}</Typography>
      </Stack>
    </Section>
  );
}

function OwnerIdentity({ businessId }: { businessId: string }) {
  const { data = [], isPending } = useGetManyReference('owner_identity_checks', {
    target: 'business_id',
    id: businessId,
    pagination: { page: 1, perPage: 20 },
    sort: { field: 'updated_at', order: 'DESC' },
  });
  const verified = data.some((check) => check.status === 'verified');
  return (
    <Section title="Owner identity">
      {isPending ? null : verified ? (
        <Typography sx={{ color: 'success.dark', display: 'flex', gap: 0.5, alignItems: 'center' }}>
          <CheckCircleOutlined fontSize="small" aria-hidden="true" />
          Verified by Stripe
        </Typography>
      ) : (
        <Typography sx={{ color: 'error.main', display: 'flex', gap: 0.5, alignItems: 'center' }}>
          <ErrorOutlined fontSize="small" aria-hidden="true" />
          Not verified. Approval will be refused until it is.
        </Typography>
      )}
    </Section>
  );
}

type Check = 'checking' | 'match' | 'mismatch' | 'error';

function DocumentRow({ doc }: { doc: DocumentRecord }) {
  const supabase = useAdminSupabase();
  const [check, setCheck] = useState<Check | null>(null);

  const open = async () => {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(doc.storage_path, SIGNED_URL_SECONDS);
    if (!error && data) window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  };

  const verify = async () => {
    setCheck('checking');
    try {
      const { data, error } = await supabase.storage.from(BUCKET).download(doc.storage_path);
      if (error || !data) throw error ?? new Error('Download failed');
      setCheck((await sha256Hex(data)) === doc.sha256 ? 'match' : 'mismatch');
    } catch {
      setCheck('error');
    }
  };

  return (
    <ListItem disableGutters sx={{ flexWrap: 'wrap', gap: 1 }}>
      <ListItemText primary={doc.file_name} secondary={DOCUMENT_LABELS[doc.kind] ?? doc.kind} />
      <Stack direction="row" spacing={1}>
        <Button
          size="small"
          startIcon={<OpenInNewOutlined />}
          aria-label={`Open ${doc.file_name}`}
          onClick={() => void open()}
        >
          Open
        </Button>
        <Button
          size="small"
          startIcon={<FingerprintOutlined />}
          aria-label={`Check fingerprint of ${doc.file_name}`}
          onClick={() => void verify()}
          loading={check === 'checking'}
        >
          Check
        </Button>
      </Stack>
      {check === 'match' && (
        <Typography
          variant="body2"
          sx={{
            color: 'success.dark',
            display: 'flex',
            gap: 0.5,
            alignItems: 'center',
            width: '100%',
          }}
        >
          <CheckCircleOutlined fontSize="small" aria-hidden="true" />
          Unchanged since upload
        </Typography>
      )}
      {check === 'mismatch' && (
        <Typography
          variant="body2"
          sx={{
            color: 'error.main',
            display: 'flex',
            gap: 0.5,
            alignItems: 'center',
            width: '100%',
          }}
        >
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

function Documents({ businessId }: { businessId: string }) {
  const { data = [], isPending } = useGetManyReference<DocumentRecord>('business_documents', {
    target: 'business_id',
    id: businessId,
    pagination: { page: 1, perPage: 50 },
    sort: { field: 'uploaded_at', order: 'ASC' },
  });
  return (
    <Section title="Documents">
      {!isPending && data.length === 0 && <Typography>No documents uploaded.</Typography>}
      <List aria-label="Documents">
        {data.map((doc) => (
          <DocumentRow key={doc.id} doc={doc} />
        ))}
      </List>
    </Section>
  );
}

function History({ businessId }: { businessId: string }) {
  const { data = [] } = useGetManyReference('verification_events', {
    target: 'business_id',
    id: businessId,
    pagination: { page: 1, perPage: 100 },
    sort: { field: 'id', order: 'ASC' },
  });
  return (
    <Section title="History">
      <List aria-label="History" dense>
        {data.map((event) => (
          <ListItem key={event.id} disableGutters>
            <ListItemText
              primary={EVENT_LABELS[String(event.action)] ?? String(event.action)}
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

type Decision = 'approve' | 'needs_info' | 'reject';

function DecisionPanel({ businessId }: { businessId: string }) {
  const supabase = useAdminSupabase();
  const refresh = useRefresh();
  const notify = useNotify();
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Decision | null>(null);

  const decide = async (decision: Decision) => {
    setError(null);
    const cleanNote = note.trim();
    if (decision !== 'approve' && !cleanNote) {
      setError('Add a note explaining the decision. The business will see it.');
      return;
    }
    setBusy(decision);
    try {
      const { error: rpcError } = await supabase.rpc('review_business', {
        p_business_id: businessId,
        p_decision: decision,
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
          Confirm the business is real, the documents are genuine and match the name and address,
          and every fingerprint is unchanged.
        </Typography>
        {error && <Alert severity="error">{error}</Alert>}
        <TextField
          label="Note to the business"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          multiline
          minRows={2}
          helperText="Required to ask for more info or reject."
        />
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
          <Button
            variant="contained"
            onClick={() => void decide('approve')}
            loading={busy === 'approve'}
          >
            Approve
          </Button>
          <Button
            variant="outlined"
            onClick={() => void decide('needs_info')}
            loading={busy === 'needs_info'}
          >
            Ask for more info
          </Button>
          <Button
            variant="outlined"
            color="error"
            onClick={() => void decide('reject')}
            loading={busy === 'reject'}
          >
            Reject
          </Button>
        </Stack>
      </Stack>
    </Section>
  );
}

function ReviewLayout() {
  const record = useRecordContext();
  if (!record) return null;
  const id = String(record.id);
  return (
    <Stack spacing={2} sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <Typography variant="h5" component="h2">
          {String(record.name)}
        </Typography>
        <StatusChip status={String(record.verification_status)} />
      </Box>
      <Details record={record} />
      <OwnerIdentity businessId={id} />
      <Documents businessId={id} />
      {record.verification_status === 'pending' && <DecisionPanel businessId={id} />}
      <History businessId={id} />
    </Stack>
  );
}

export function BusinessShow() {
  return (
    <Show title="Review business">
      <ReviewLayout />
    </Show>
  );
}
