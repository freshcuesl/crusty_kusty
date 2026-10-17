import DeleteOutlined from '@mui/icons-material/DeleteOutlined';
import DescriptionOutlined from '@mui/icons-material/DescriptionOutlined';
import UploadFileOutlined from '@mui/icons-material/UploadFileOutlined';
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
  TextField,
  Typography,
} from '@mui/material';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { formatUsPhone, friendlyError, normalizeUsPhone, sha256Hex } from '@cs/core';
import { useAuth } from '../auth/AuthProvider';
import type { Membership } from '../auth/authStep';
import { useSupabase } from '../auth/SupabaseProvider';
import { FormError } from '../auth/ui';
import { currentIdentity, identityReason, type IdentityCheck } from './identity';
import { functionErrorMessage } from '../lib/functionError';
import { redirectTo } from './redirect';
import { US_STATES } from '../lib/usStates';
import { ACCEPTED_DOCUMENT_TYPES, checkDocumentFile, storagePathFor } from './verificationUtils';

type Status = Membership['verificationStatus'] | 'needs_info';

interface BusinessRow {
  verification_status: Status;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  review_note: string | null;
}

interface DocumentRow {
  id: string;
  kind: DocumentKind;
  file_name: string;
  storage_path: string;
  uploaded_at: string;
}

type DocumentKind = 'business_license' | 'ein_letter' | 'insurance_certificate';

const KIND_LABELS: Record<DocumentKind, string> = {
  business_license: 'Business license',
  ein_letter: 'EIN letter from the IRS',
  insurance_certificate: 'Certificate of insurance',
};

const BUCKET = 'business-documents';
const EDITABLE: Status[] = ['unverified', 'needs_info', 'rejected'];

async function fetchVerification(supabase: SupabaseClient, businessId: string) {
  const { data: business, error } = await supabase
    .from('businesses')
    .select(
      'verification_status, phone, address_line1, address_line2, city, state, postal_code, review_note',
    )
    .eq('id', businessId)
    .single<BusinessRow>();
  if (error) throw error;
  const { data: documents, error: docsError } = await supabase
    .from('business_documents')
    .select('id, kind, file_name, storage_path, uploaded_at')
    .eq('business_id', businessId)
    .order('uploaded_at');
  if (docsError) throw docsError;
  const { data: checks, error: checksError } = await supabase
    .from('owner_identity_checks')
    .select('status, last_error_code, updated_at')
    .eq('business_id', businessId)
    .order('updated_at', { ascending: false });
  if (checksError) throw checksError;
  return {
    business,
    documents: (documents as DocumentRow[] | null) ?? [],
    identity: currentIdentity((checks as IdentityCheck[] | null) ?? []),
  };
}

function StatusBanner({ business }: { business: BusinessRow }) {
  const messages: Record<Status, { severity: 'info' | 'warning' | 'success'; text: ReactNode }> = {
    unverified: {
      severity: 'info',
      text: 'Complete the four steps below. A moderator usually reviews within 1–2 business days.',
    },
    pending: {
      severity: 'info',
      text: "We're reviewing your business. You'll be able to make changes again if we need anything.",
    },
    needs_info: {
      severity: 'warning',
      text: (
        <>
          A moderator needs more information:
          <Box component="blockquote" sx={{ m: 0, mt: 1, fontWeight: 600 }}>
            {business.review_note}
          </Box>
        </>
      ),
    },
    rejected: {
      severity: 'warning',
      text: (
        <>
          Verification was declined:
          <Box component="blockquote" sx={{ m: 0, mt: 1, fontWeight: 600 }}>
            {business.review_note}
          </Box>
          You can fix the issue and submit again.
        </>
      ),
    },
    verified: {
      severity: 'success',
      text: 'Your business is verified. Customer checks and incident reports are unlocked.',
    },
    suspended: {
      severity: 'warning',
      text: 'Your business is suspended. Contact support.',
    },
  };
  const { severity, text } = messages[business.verification_status];
  return (
    <Alert severity={severity} role="status">
      {text}
    </Alert>
  );
}

export function VerificationPage() {
  const supabase = useSupabase();
  const { membership, refresh } = useAuth();
  const businessId = membership?.businessId ?? '';
  const isOwner = membership?.role === 'owner';

  const [business, setBusiness] = useState<BusinessRow | null>(null);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [identity, setIdentity] = useState<IdentityCheck | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const apply = useCallback((data: Awaited<ReturnType<typeof fetchVerification>>) => {
    setBusiness(data.business);
    setDocuments(data.documents);
    setIdentity(data.identity);
  }, []);

  const reload = useCallback(
    () =>
      fetchVerification(supabase, businessId).then(apply, (thrown: unknown) =>
        setLoadError(friendlyError(thrown)),
      ),
    [supabase, businessId, apply],
  );

  useEffect(() => {
    let active = true;
    fetchVerification(supabase, businessId).then(
      (data) => active && apply(data),
      (thrown: unknown) => active && setLoadError(friendlyError(thrown)),
    );
    return () => {
      active = false;
    };
  }, [supabase, businessId, apply]);

  if (!business) {
    return <FormError message={loadError} />;
  }

  const editable = isOwner && EDITABLE.includes(business.verification_status);

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h4" component="h1">
          Verification
        </Typography>
        <Typography color="text.secondary">{membership?.businessName}</Typography>
      </Box>

      <StatusBanner business={business} />
      {!isOwner && (
        <Alert severity="info" role="status">
          Only the owner can update verification. Ask them if something needs to change.
        </Alert>
      )}

      {editable && (
        <>
          <DetailsForm business={business} onSaved={reload} />
          <DocumentsSection businessId={businessId} documents={documents} onChanged={reload} />
          <IdentitySection identity={identity} onRefresh={reload} />
          <SubmitSection
            onSubmitted={async () => {
              await reload();
              await refresh();
            }}
          />
        </>
      )}

      {!editable && (
        <Typography>
          Owner identity: {identity?.status === 'verified' ? 'verified' : 'not verified yet'}
        </Typography>
      )}
      {!editable && documents.length > 0 && <DocumentList documents={documents} />}
    </Stack>
  );
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

function DetailsForm({ business, onSaved }: { business: BusinessRow; onSaved: () => unknown }) {
  const supabase = useSupabase();
  const [phone, setPhone] = useState(business.phone ? formatUsPhone(business.phone) : '');
  const [line1, setLine1] = useState(business.address_line1 ?? '');
  const [line2, setLine2] = useState(business.address_line2 ?? '');
  const [city, setCity] = useState(business.city ?? '');
  const [state, setState] = useState(business.state ?? '');
  const [zip, setZip] = useState(business.postal_code ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSaved(false);
    const normalized = normalizeUsPhone(phone);
    if (!normalized) {
      setError('Enter a 10-digit US phone number.');
      return;
    }
    setBusy(true);
    try {
      const { error: rpcError } = await supabase.rpc('update_business_details', {
        p_phone: normalized,
        p_address_line1: line1,
        p_address_line2: line2,
        p_city: city,
        p_state: state,
        p_postal_code: zip,
      });
      if (rpcError) {
        setError(friendlyError(rpcError));
        return;
      }
      setSaved(true);
      await onSaved();
    } catch (thrown) {
      setError(friendlyError(thrown));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section title="1. Business details">
      <form onSubmit={submit} noValidate>
        <Stack spacing={2}>
          <FormError message={error} />
          {saved && (
            <Alert severity="success" role="status">
              Details saved.
            </Alert>
          )}
          <TextField
            label="Business phone"
            type="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(206) 555-0100"
          />
          <TextField
            label="Street address"
            autoComplete="address-line1"
            value={line1}
            onChange={(e) => setLine1(e.target.value)}
          />
          <TextField
            label="Suite or unit (optional)"
            autoComplete="address-line2"
            value={line2}
            onChange={(e) => setLine2(e.target.value)}
          />
          <TextField
            label="City"
            autoComplete="address-level2"
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />
          <Stack direction="row" spacing={2}>
            <TextField
              select
              label="State"
              value={state}
              onChange={(e) => setState(e.target.value)}
              slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
              sx={{ minWidth: 110 }}
            >
              <option value="">Choose</option>
              {US_STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </TextField>
            <TextField
              label="ZIP code"
              autoComplete="postal-code"
              value={zip}
              onChange={(e) => setZip(e.target.value)}
              slotProps={{ htmlInput: { inputMode: 'numeric' } }}
              fullWidth
            />
          </Stack>
          <Button type="submit" variant="contained" loading={busy}>
            Save details
          </Button>
        </Stack>
      </form>
    </Section>
  );
}

function DocumentList({
  documents,
  onRemove,
}: {
  documents: DocumentRow[];
  onRemove?: (doc: DocumentRow) => void;
}) {
  return (
    <List aria-label="Uploaded documents">
      {documents.map((doc) => (
        <ListItem
          key={doc.id}
          disableGutters
          secondaryAction={
            onRemove ? (
              <IconButton aria-label={`Remove ${doc.file_name}`} onClick={() => onRemove(doc)}>
                <DeleteOutlined />
              </IconButton>
            ) : undefined
          }
        >
          <ListItemIcon>
            <DescriptionOutlined aria-hidden="true" />
          </ListItemIcon>
          <ListItemText primary={doc.file_name} secondary={KIND_LABELS[doc.kind]} />
        </ListItem>
      ))}
    </List>
  );
}

function DocumentsSection({
  businessId,
  documents,
  onChanged,
}: {
  businessId: string;
  documents: DocumentRow[];
  onChanged: () => unknown;
}) {
  const supabase = useSupabase();
  const [kind, setKind] = useState<DocumentKind | ''>('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const upload = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!kind) {
      setError('Choose the document type.');
      return;
    }
    if (!file) {
      setError('Choose a file to upload.');
      return;
    }
    const problem = checkDocumentFile(file);
    if (problem) {
      setError(problem);
      return;
    }

    setBusy(true);
    const path = storagePathFor(businessId, file.name);
    try {
      const fingerprint = await sha256Hex(file);
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) {
        setError(friendlyError(uploadError));
        return;
      }
      const { error: rpcError } = await supabase.rpc('add_business_document', {
        p_kind: kind,
        p_storage_path: path,
        p_file_name: file.name,
        p_mime_type: file.type,
        p_size_bytes: file.size,
        p_sha256: fingerprint,
      });
      if (rpcError) {
        // Don't leave an unrecorded file behind.
        await supabase.storage.from(BUCKET).remove([path]);
        setError(friendlyError(rpcError));
        return;
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

  const remove = async (doc: DocumentRow) => {
    setError(null);
    const { data: path, error: rpcError } = await supabase.rpc('remove_business_document', {
      p_document_id: doc.id,
    });
    if (rpcError) {
      setError(friendlyError(rpcError));
      return;
    }
    await supabase.storage.from(BUCKET).remove([path as string]);
    await onChanged();
  };

  return (
    <Section title="2. Proof documents">
      <Stack spacing={2}>
        <Typography color="text.secondary">
          Upload at least one: a business license, an EIN letter from the IRS, or a certificate of
          insurance. PDFs or clear photos, up to 10 MB.
        </Typography>
        {documents.length > 0 && <DocumentList documents={documents} onRemove={remove} />}
        <form onSubmit={upload} noValidate>
          <Stack spacing={2}>
            <FormError message={error} />
            <TextField
              select
              label="Document type"
              value={kind}
              onChange={(e) => setKind(e.target.value as DocumentKind)}
              slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
            >
              <option value="">Choose</option>
              {(Object.keys(KIND_LABELS) as DocumentKind[]).map((k) => (
                <option key={k} value={k}>
                  {KIND_LABELS[k]}
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
              Upload document
            </Button>
          </Stack>
        </form>
      </Stack>
    </Section>
  );
}

function SubmitSection({ onSubmitted }: { onSubmitted: () => Promise<void> }) {
  const supabase = useSupabase();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      const { error: rpcError } = await supabase.rpc('submit_for_verification');
      if (rpcError) {
        setError(friendlyError(rpcError));
        return;
      }
      await onSubmitted();
    } catch (thrown) {
      setError(friendlyError(thrown));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section title="4. Submit for review">
      <Stack spacing={2}>
        <Typography color="text.secondary">
          A moderator checks that your business is real and the documents match. Your details and
          documents are locked while we review.
        </Typography>
        <FormError message={error} />
        <Button variant="contained" size="large" onClick={() => void submit()} loading={busy}>
          Submit for review
        </Button>
      </Stack>
    </Section>
  );
}

function IdentitySection({
  identity,
  onRefresh,
}: {
  identity: IdentityCheck | null;
  onRefresh: () => unknown;
}) {
  const supabase = useSupabase();
  const [params] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const returned = params.get('identity') === 'returned';

  const start = async () => {
    setError(null);
    setBusy(true);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke<{ url: string }>(
        'create-identity-session',
        { method: 'POST' },
      );
      if (invokeError || !data?.url) {
        setError(await functionErrorMessage(invokeError));
        return;
      }
      redirectTo(data.url);
    } catch (thrown) {
      setError(friendlyError(thrown));
    } finally {
      setBusy(false);
    }
  };

  const status = identity?.status;
  // Just back from Stripe, before its result arrives: show the waiting message.
  const waiting =
    status === 'processing' ||
    (returned && status === 'requires_input' && !identity?.last_error_code);

  return (
    <Section title="3. Verify your identity">
      <Stack spacing={2}>
        {status === 'verified' ? (
          <Alert severity="success" role="status">
            Identity verified by Stripe.
          </Alert>
        ) : waiting ? (
          <>
            <Alert severity="info" role="status">
              Stripe is checking your ID. This usually takes a minute.
            </Alert>
            <Button variant="outlined" onClick={() => void onRefresh()}>
              Check again
            </Button>
          </>
        ) : (
          <>
            <Typography color="text.secondary">
              Stripe checks a photo of your driver's license, passport or state ID and a live
              selfie. ClientShield never sees or stores your ID, only whether it passed.
            </Typography>
            {status === 'requires_input' && (
              <Alert severity="warning" role="status">
                {identityReason(identity?.last_error_code ?? null)} Try again.
              </Alert>
            )}
            <FormError message={error} />
            <Button variant="contained" onClick={() => void start()} loading={busy}>
              {status ? 'Try again' : 'Verify my identity'}
            </Button>
          </>
        )}
      </Stack>
    </Section>
  );
}
