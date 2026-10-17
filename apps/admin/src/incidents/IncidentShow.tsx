import OpenInNewOutlined from '@mui/icons-material/OpenInNewOutlined';
import { Box, Link, List, Stack, Typography } from '@mui/material';
import { Show, useGetManyReference, useGetOne, useRecordContext, type RaRecord } from 'react-admin';
import {
  CATEGORY_LABELS,
  EVIDENCE_LABELS,
  formatUsPhone,
  INCIDENT_EVENT_LABELS,
  type EvidenceKind,
  type IncidentCategory,
  type IncidentStatus,
} from '@cs/core';
import {
  DecisionPanel,
  FileRow,
  HistoryList,
  Section,
  type DecisionOption,
} from '../review/ReviewParts';
import { IncidentStatusChip } from './IncidentList';

const INCIDENT_DECISIONS: DecisionOption[] = [
  { value: 'verify', label: 'Verify evidence', variant: 'contained', requiresNote: false },
  { value: 'needs_info', label: 'Ask for more info', variant: 'outlined', requiresNote: true },
  { value: 'reject', label: 'Reject', variant: 'outlined', color: 'error', requiresNote: true },
];

function useIncidentReference(resource: string, incidentId: string, sortField: string) {
  return useGetManyReference(resource, {
    target: 'incident_id',
    id: incidentId,
    pagination: { page: 1, perPage: 100 },
    sort: { field: sortField, order: 'ASC' },
  });
}

function Reporter({ businessId }: { businessId: string }) {
  const { data } = useGetOne('businesses', { id: businessId });
  return (
    <Typography color="text.secondary">Reported by {data ? String(data.name) : '…'}</Typography>
  );
}

function Customer({ incidentId }: { incidentId: string }) {
  const { data = [] } = useIncidentReference('incident_customers', incidentId, 'incident_id');
  const c = data[0];
  if (!c) return null;
  const address = [
    c.address_line1,
    c.address_line2,
    [c.city, c.state].filter(Boolean).join(', '),
    c.postal_code,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <Section title="Customer">
      <Stack spacing={0.5}>
        <Typography sx={{ fontWeight: 600 }}>{String(c.full_name)}</Typography>
        {c.phone && <Typography>{formatUsPhone(String(c.phone))}</Typography>}
        {c.email && <Typography>{String(c.email)}</Typography>}
        {address && <Typography>{address}</Typography>}
      </Stack>
    </Section>
  );
}

function Dispute({ record }: { record: RaRecord }) {
  return (
    <Section title="Dispute">
      <Stack spacing={1}>
        <Typography>
          {String(record.service_type)} on {String(record.service_date)}
          {record.invoice_number ? ` · ${String(record.invoice_number)}` : ''}
        </Typography>
        <Typography sx={{ whiteSpace: 'pre-wrap' }}>{String(record.description)}</Typography>
        {record.review_url && (
          <Box>
            <Typography>
              Google review: {String(record.review_rating)} star(s)
              {record.review_date ? `, ${String(record.review_date)}` : ''}
            </Typography>
            {record.review_text && (
              <Typography sx={{ fontStyle: 'italic' }}>“{String(record.review_text)}”</Typography>
            )}
            <Link
              href={String(record.review_url)}
              target="_blank"
              rel="noopener noreferrer"
              sx={{ display: 'inline-flex', gap: 0.5, alignItems: 'center' }}
            >
              Open the Google review <OpenInNewOutlined fontSize="small" aria-hidden="true" />
            </Link>
          </Box>
        )}
      </Stack>
    </Section>
  );
}

function Evidence({ incidentId }: { incidentId: string }) {
  const { data = [], isPending } = useIncidentReference(
    'incident_evidence',
    incidentId,
    'uploaded_at',
  );
  return (
    <Section title="Evidence">
      {!isPending && data.length === 0 && <Typography>No evidence uploaded.</Typography>}
      <List aria-label="Evidence">
        {data.map((e) => (
          <FileRow
            key={e.id}
            bucket="incident-evidence"
            fileName={String(e.file_name)}
            storagePath={String(e.storage_path)}
            sha256={String(e.sha256)}
            kindLabel={EVIDENCE_LABELS[e.kind as EvidenceKind] ?? String(e.kind)}
          />
        ))}
      </List>
    </Section>
  );
}

function History({ incidentId }: { incidentId: string }) {
  const { data = [] } = useIncidentReference('incident_events', incidentId, 'id');
  return <HistoryList events={data} labels={INCIDENT_EVENT_LABELS} />;
}

function ReviewLayout() {
  const record = useRecordContext();
  if (!record) return null;
  const id = String(record.id);
  return (
    <Stack spacing={2} sx={{ p: 2 }}>
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Typography variant="h5" component="h2">
            {CATEGORY_LABELS[record.category as IncidentCategory]}
          </Typography>
          <IncidentStatusChip status={record.status as IncidentStatus} />
        </Box>
        <Reporter businessId={String(record.business_id)} />
      </Box>
      <Customer incidentId={id} />
      <Dispute record={record} />
      <Evidence incidentId={id} />
      {record.status === 'submitted' && (
        <DecisionPanel
          rpc="review_incident"
          target={{ p_incident_id: id }}
          options={INCIDENT_DECISIONS}
          noteLabel="Note to the reporter"
          audience="reporter"
          guidance="Confirm the job happened, the dispute happened and the evidence exists, and every fingerprint is unchanged. Don't decide who was right."
        />
      )}
      <History incidentId={id} />
    </Stack>
  );
}

export function IncidentShow() {
  return (
    <Show title="Review incident">
      <ReviewLayout />
    </Show>
  );
}
