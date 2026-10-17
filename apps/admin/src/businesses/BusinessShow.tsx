import CheckCircleOutlined from '@mui/icons-material/CheckCircleOutlined';
import ErrorOutlined from '@mui/icons-material/ErrorOutlined';
import { Box, List, Stack, Typography } from '@mui/material';
import { Show, useGetManyReference, useRecordContext, type RaRecord } from 'react-admin';
import { formatUsPhone } from '@cs/core';
import {
  DecisionPanel,
  FileRow,
  HistoryList,
  Section,
  type DecisionOption,
} from '../review/ReviewParts';
import { StatusChip } from './BusinessList';
import { DOCUMENT_LABELS, EVENT_LABELS } from './labels';

const BUCKET = 'business-documents';

interface DocumentRecord extends RaRecord {
  kind: string;
  file_name: string;
  storage_path: string;
  sha256: string;
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
          <FileRow
            key={doc.id}
            bucket={BUCKET}
            fileName={doc.file_name}
            storagePath={doc.storage_path}
            sha256={doc.sha256}
            kindLabel={DOCUMENT_LABELS[doc.kind] ?? doc.kind}
          />
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
  return <HistoryList events={data} labels={EVENT_LABELS} />;
}

const BUSINESS_DECISIONS: DecisionOption[] = [
  { value: 'approve', label: 'Approve', variant: 'contained', requiresNote: false },
  { value: 'needs_info', label: 'Ask for more info', variant: 'outlined', requiresNote: true },
  { value: 'reject', label: 'Reject', variant: 'outlined', color: 'error', requiresNote: true },
];

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
      {record.verification_status === 'pending' && (
        <DecisionPanel
          rpc="review_business"
          target={{ p_business_id: id }}
          options={BUSINESS_DECISIONS}
          noteLabel="Note to the business"
          audience="business"
          guidance="Confirm the business is real, the documents are genuine and match the name and address, and every fingerprint is unchanged."
        />
      )}
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
