import DeleteOutlined from '@mui/icons-material/DeleteOutlined';
import DescriptionOutlined from '@mui/icons-material/DescriptionOutlined';
import UploadFileOutlined from '@mui/icons-material/UploadFileOutlined';
import {
  Alert,
  Box,
  Button,
  Chip,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useParams } from 'react-router';
import {
  CATEGORY_LABELS,
  EVIDENCE_LABELS,
  friendlyError,
  INCIDENT_EVENT_LABELS,
  INCIDENT_STATUS_LABELS,
  sha256Hex,
  type EvidenceKind,
  type IncidentCategory,
  type IncidentStatus,
} from '@cs/core';
import { useAuth } from '../auth/AuthProvider';
import { useSupabase } from '../auth/SupabaseProvider';
import { FormError, FullPageSpinner } from '../auth/ui';
import {
  ACCEPTED_DOCUMENT_TYPES,
  checkDocumentFile,
  storagePathFor,
} from '../verification/verificationUtils';
import { IncidentForm, type IncidentFormValues } from './IncidentForm';

const BUCKET = 'incident-evidence';
const MAX_EVIDENCE_BYTES = 15 * 1024 * 1024;

interface IncidentRow extends IncidentFormValues {
  id: string;
  business_id: string;
  status: IncidentStatus;
  category: IncidentCategory;
  review_note: string | null;
  expires_at: string | null;
}

interface EvidenceRow {
  id: string;
  kind: EvidenceKind;
  file_name: string;
  storage_path: string;
}

interface EventRow {
  id: number;
  action: string;
  note: string | null;
  created_at: string;
}

async function fetchIncident(supabase: SupabaseClient, id: string) {
  // Four independent reads, sent together: one round trip instead of four.
  const [
    { data: incident, error },
    { data: customer },
    { data: evidence, error: evidenceError },
    { data: events, error: eventsError },
  ] = await Promise.all([
    supabase.from('incidents').select('*').eq('id', id).single<IncidentRow>(),
    supabase.from('incident_customers').select('*').eq('incident_id', id).single(),
    supabase
      .from('incident_evidence')
      .select('id, kind, file_name, storage_path')
      .eq('incident_id', id)
      .order('uploaded_at'),
    supabase
      .from('incident_events')
      .select('id, action, note, created_at')
      .eq('incident_id', id)
      .order('id'),
  ]);
  if (error) throw error;
  if (evidenceError) throw evidenceError;
  if (eventsError) throw eventsError;
  return {
    incident: { ...incident, customer } as IncidentRow,
    evidence: (evidence as EvidenceRow[] | null) ?? [],
    events: (events as EventRow[] | null) ?? [],
  };
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
      <Typography variant="h6" component="h2" sx={{ mb: 2 }}>
        {title}
      </Typography>
      {children}
    </Paper>
  );
}

function StatusBanner({ incident }: { incident: IncidentRow }) {
  switch (incident.status) {
    case 'draft':
      return (
        <Alert severity="info" role="status">
          Add your evidence, then submit for review. Nothing is shared until a moderator verifies
          it.
        </Alert>
      );
    case 'submitted':
      return (
        <Alert severity="info" role="status">
          A moderator is reviewing this incident. Changes are locked until then.
        </Alert>
      );
    case 'needs_info':
      return (
        <Alert severity="warning" role="status">
          A moderator needs more information:
          <Box component="blockquote" sx={{ m: 0, mt: 1, fontWeight: 600 }}>
            {incident.review_note}
          </Box>
        </Alert>
      );
    case 'evidence_verified':
      return (
        <Alert severity="success" role="status">
          Evidence verified. This record expires on{' '}
          {incident.expires_at
            ? new Date(incident.expires_at).toLocaleDateString()
            : 'its expiry date'}
          .
        </Alert>
      );
    case 'rejected':
      return (
        <Alert severity="warning" role="status">
          A moderator could not verify this incident:
          <Box component="blockquote" sx={{ m: 0, mt: 1, fontWeight: 600 }}>
            {incident.review_note}
          </Box>
        </Alert>
      );
    case 'expired':
      return (
        <Alert severity="info" role="status">
          This record has expired. Its customer details and evidence were deleted, and it no longer
          appears in customer checks.
        </Alert>
      );
  }
}

export function IncidentPage() {
  const { id = '' } = useParams();
  const supabase = useSupabase();
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchIncident>> | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const reload = useCallback(
    () =>
      fetchIncident(supabase, id).then(setData, (thrown: unknown) =>
        setLoadError(friendlyError(thrown)),
      ),
    [supabase, id],
  );

  useEffect(() => {
    let active = true;
    fetchIncident(supabase, id).then(
      (result) => active && setData(result),
      (thrown: unknown) => active && setLoadError(friendlyError(thrown)),
    );
    return () => {
      active = false;
    };
  }, [supabase, id]);

  if (!data) return loadError ? <FormError message={loadError} /> : <FullPageSpinner />;

  const { incident, evidence, events } = data;
  const editable = incident.status === 'draft' || incident.status === 'needs_info';

  return (
    <Stack spacing={3}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <Typography variant="h4" component="h1">
          {CATEGORY_LABELS[incident.category]}
        </Typography>
        <Chip label={INCIDENT_STATUS_LABELS[incident.status]} />
      </Box>

      <StatusBanner incident={incident} />

      {editable ? (
        <>
          <IncidentForm
            key={`${incident.id}-${events.length}`}
            initial={incident}
            submitLabel="Save changes"
            onSave={async (payload) => {
              try {
                const { error } = await supabase.rpc('update_incident', {
                  p_incident_id: incident.id,
                  ...payload,
                });
                if (error) return friendlyError(error);
                await reload();
                return null;
              } catch (thrown) {
                return friendlyError(thrown);
              }
            }}
          />
          <EvidenceSection incident={incident} evidence={evidence} onChanged={reload} />
          <SubmitSection incidentId={incident.id} onSubmitted={reload} />
        </>
      ) : (
        <>
          <Summary incident={incident} />
          <Section title="Evidence">
            <EvidenceList evidence={evidence} />
          </Section>
        </>
      )}

      <Section title="History">
        <List aria-label="History" dense>
          {events.map((event) => (
            <ListItem key={event.id} disableGutters>
              <ListItemText
                primary={INCIDENT_EVENT_LABELS[event.action] ?? event.action}
                secondary={[new Date(event.created_at).toLocaleString(), event.note]
                  .filter(Boolean)
                  .join(' · ')}
              />
            </ListItem>
          ))}
        </List>
      </Section>
    </Stack>
  );
}

function Summary({ incident }: { incident: IncidentRow }) {
  const c = incident.customer;
  return (
    <Section title="Report">
      <Stack spacing={1}>
        <Typography>
          <strong>Customer:</strong> {c?.full_name}
        </Typography>
        <Typography>
          <strong>Service:</strong> {incident.service_type} on {incident.service_date}
          {incident.invoice_number ? ` · ${incident.invoice_number}` : ''}
        </Typography>
        <Typography sx={{ whiteSpace: 'pre-wrap' }}>{incident.description}</Typography>
        {incident.review_url && (
          <Typography>
            <strong>Google review:</strong> {incident.review_rating} star(s), {incident.review_date}
          </Typography>
        )}
      </Stack>
    </Section>
  );
}

function EvidenceList({
  evidence,
  onRemove,
}: {
  evidence: EvidenceRow[];
  onRemove?: (row: EvidenceRow) => void;
}) {
  if (evidence.length === 0) return <Typography>No evidence yet.</Typography>;
  return (
    <List aria-label="Evidence">
      {evidence.map((row) => (
        <ListItem
          key={row.id}
          disableGutters
          secondaryAction={
            onRemove ? (
              <IconButton aria-label={`Remove ${row.file_name}`} onClick={() => onRemove(row)}>
                <DeleteOutlined />
              </IconButton>
            ) : undefined
          }
        >
          <ListItemIcon>
            <DescriptionOutlined aria-hidden="true" />
          </ListItemIcon>
          <ListItemText primary={row.file_name} secondary={EVIDENCE_LABELS[row.kind]} />
        </ListItem>
      ))}
    </List>
  );
}

function EvidenceSection({
  incident,
  evidence,
  onChanged,
}: {
  incident: IncidentRow;
  evidence: EvidenceRow[];
  onChanged: () => unknown;
}) {
  const supabase = useSupabase();
  const { membership } = useAuth();
  const [kind, setKind] = useState<EvidenceKind | ''>('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const upload = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!kind) return setError('Choose the evidence type.');
    if (!file) return setError('Choose a file to upload.');
    const problem = checkDocumentFile(file, MAX_EVIDENCE_BYTES);
    if (problem) return setError(problem);

    setBusy(true);
    const folder = `${membership?.businessId ?? incident.business_id}/${incident.id}`;
    const path = storagePathFor(folder, file.name);
    try {
      const fingerprint = await sha256Hex(file);
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) return setError(friendlyError(uploadError));
      const { error: rpcError } = await supabase.rpc('add_incident_evidence', {
        p_incident_id: incident.id,
        p_kind: kind,
        p_storage_path: path,
        p_file_name: file.name,
        p_mime_type: file.type,
        p_size_bytes: file.size,
        p_sha256: fingerprint,
      });
      if (rpcError) {
        await supabase.storage.from(BUCKET).remove([path]);
        return setError(friendlyError(rpcError));
      }
      setFile(null);
      setKind('');
      await onChanged();
    } catch (thrown) {
      setError(friendlyError(thrown));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (row: EvidenceRow) => {
    setError(null);
    const { data: path, error: rpcError } = await supabase.rpc('remove_incident_evidence', {
      p_evidence_id: row.id,
    });
    if (rpcError) return setError(friendlyError(rpcError));
    await supabase.storage.from(BUCKET).remove([path as string]);
    await onChanged();
  };

  return (
    <Section title="Evidence">
      <Stack spacing={2}>
        <Typography color="text.secondary">
          Before and after photos, the invoice, the signed work order, messages, notes, refund
          records. PDFs or photos up to 15 MB. Each file is fingerprinted when it's uploaded.
        </Typography>
        <EvidenceList evidence={evidence} onRemove={remove} />
        <form onSubmit={upload} noValidate>
          <Stack spacing={2}>
            <FormError message={error} />
            <TextField
              select
              label="Evidence type"
              value={kind}
              onChange={(e) => setKind(e.target.value as EvidenceKind)}
              slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
            >
              <option value="">Choose</option>
              {(Object.keys(EVIDENCE_LABELS) as EvidenceKind[]).map((k) => (
                <option key={k} value={k}>
                  {EVIDENCE_LABELS[k]}
                </option>
              ))}
            </TextField>
            <Button component="label" variant="outlined" startIcon={<UploadFileOutlined />}>
              {file ? file.name : 'Choose file'}
              <input
                type="file"
                hidden
                aria-label="Choose file"
                accept={ACCEPTED_DOCUMENT_TYPES.join(',')}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </Button>
            <Button type="submit" variant="contained" loading={busy}>
              Upload evidence
            </Button>
          </Stack>
        </form>
      </Stack>
    </Section>
  );
}

function SubmitSection({
  incidentId,
  onSubmitted,
}: {
  incidentId: string;
  onSubmitted: () => unknown;
}) {
  const supabase = useSupabase();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      const { error: rpcError } = await supabase.rpc('submit_incident', {
        p_incident_id: incidentId,
      });
      if (rpcError) return setError(friendlyError(rpcError));
      await onSubmitted();
    } catch (thrown) {
      setError(friendlyError(thrown));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section title="Submit for review">
      <Stack spacing={2}>
        <Typography color="text.secondary">
          A moderator confirms the job and the dispute happened and the evidence exists. They don't
          decide who was right. The report is locked while it's reviewed.
        </Typography>
        <FormError message={error} />
        <Button variant="contained" size="large" onClick={() => void submit()} loading={busy}>
          Submit for review
        </Button>
      </Stack>
    </Section>
  );
}
