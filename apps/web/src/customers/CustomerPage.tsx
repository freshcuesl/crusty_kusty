import DeleteOutlined from '@mui/icons-material/DeleteOutlined';
import {
  Box,
  Button,
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
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router';
import { formatUsPhone, friendlyError } from '@cs/core';
import { ConfirmDialog } from '../account/ConfirmDialog';
import { useAuth } from '../auth/AuthProvider';
import { useSupabase } from '../auth/SupabaseProvider';
import { FormError, FullPageSpinner } from '../auth/ui';
import { MatchResult, type CheckResult } from '../matching/MatchResult';

interface Customer {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
}

interface Note {
  id: string;
  body: string;
  author_id: string;
  created_at: string;
}

async function fetchCustomer(supabase: SupabaseClient, id: string) {
  const { data, error } = await supabase.from('customers').select('*').eq('id', id).single();
  if (error) throw error;
  return data as Customer | null;
}

async function fetchNotes(supabase: SupabaseClient, customerId: string) {
  const { data, error } = await supabase
    .from('customer_notes')
    .select('id, body, author_id, created_at')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as Note[] | null) ?? [];
}

function addressOf(c: Customer): string | null {
  const street = [c.address_line1, c.address_line2].filter(Boolean).join(' ');
  const region = [c.state, c.postal_code].filter(Boolean).join(' ');
  const line = [street, c.city, region].filter(Boolean).join(', ');
  return line || null;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
      <Typography variant="h6" component="h2" sx={{ mb: 1 }}>
        {title}
      </Typography>
      {children}
    </Paper>
  );
}

function Detail({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <Box sx={{ py: 0.5 }}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography>{value}</Typography>
    </Box>
  );
}

function NotesSection({ customerId }: { customerId: string }) {
  const supabase = useSupabase();
  const { user, membership } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    () =>
      fetchNotes(supabase, customerId).then(setNotes, (t: unknown) => setError(friendlyError(t))),
    [supabase, customerId],
  );
  useEffect(() => {
    void load();
  }, [load]);

  const run = async (call: () => PromiseLike<{ error: unknown }>, after?: () => void) => {
    setError(null);
    setBusy(true);
    try {
      const { error: rpcError } = await call();
      if (rpcError) return setError(friendlyError(rpcError));
      after?.();
      await load();
    } catch (thrown) {
      setError(friendlyError(thrown));
    } finally {
      setBusy(false);
    }
  };

  const add = (event: FormEvent) => {
    event.preventDefault();
    void run(
      () => supabase.rpc('add_customer_note', { p_customer_id: customerId, p_body: draft }),
      () => setDraft(''),
    );
  };

  const canDelete = (note: Note) => membership?.role === 'owner' || note.author_id === user?.id;

  return (
    <Section title="Private notes">
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Only people in your business can read these. Notes are never shared with other businesses
        and never used for matching.
      </Typography>
      <Stack component="form" onSubmit={add} spacing={1.5} noValidate>
        <TextField
          label="New note"
          multiline
          minRows={2}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          slotProps={{ htmlInput: { maxLength: 2000 } }}
        />
        <FormError message={error} />
        <Box>
          <Button type="submit" variant="contained" loading={busy}>
            Add note
          </Button>
        </Box>
      </Stack>
      {notes.length > 0 && (
        <List aria-label="Notes" sx={{ mt: 2 }}>
          {notes.map((note) => (
            <ListItem
              key={note.id}
              divider
              disableGutters
              secondaryAction={
                canDelete(note) && (
                  <IconButton
                    edge="end"
                    aria-label={`Delete note from ${new Date(note.created_at).toLocaleDateString()}`}
                    onClick={() =>
                      void run(() => supabase.rpc('delete_customer_note', { p_note_id: note.id }))
                    }
                  >
                    <DeleteOutlined />
                  </IconButton>
                )
              }
            >
              <ListItemText
                primary={note.body}
                secondary={new Date(note.created_at).toLocaleString()}
                slotProps={{ primary: { sx: { whiteSpace: 'pre-wrap' } } }}
              />
            </ListItem>
          ))}
        </List>
      )}
    </Section>
  );
}

export function CustomerPage() {
  const { id = '' } = useParams();
  const supabase = useSupabase();
  const navigate = useNavigate();
  const { membership } = useAuth();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let active = true;
    fetchCustomer(supabase, id)
      .then(
        (found) => {
          if (!active) return;
          if (found) setCustomer(found);
          else setError('Customer not found.');
        },
        (thrown: unknown) => active && setError(friendlyError(thrown)),
      )
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [supabase, id]);

  const recheck = async () => {
    setError(null);
    setChecking(true);
    try {
      const { data, error: rpcError } = await supabase.rpc('recheck_customer', {
        p_customer_id: id,
      });
      if (rpcError) setError(friendlyError(rpcError));
      else setResult(data as CheckResult);
    } catch (thrown) {
      setError(friendlyError(thrown));
    } finally {
      setChecking(false);
    }
  };

  const remove = async () => {
    setDeleting(true);
    try {
      const { error: rpcError } = await supabase.rpc('delete_customer', { p_customer_id: id });
      if (rpcError) {
        setError(friendlyError(rpcError));
        setConfirming(false);
        return;
      }
      void navigate('/customers');
    } catch (thrown) {
      setError(friendlyError(thrown));
      setConfirming(false);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <FullPageSpinner />;
  if (!customer) return <FormError message={error} />;

  return (
    <Stack spacing={3}>
      <Typography variant="h4" component="h1">
        {customer.full_name}
      </Typography>

      <Section title="Details">
        <Detail label="Phone" value={customer.phone && formatUsPhone(customer.phone)} />
        <Detail label="Email" value={customer.email} />
        <Detail label="Address" value={addressOf(customer)} />
      </Section>

      <Section title="Customer check">
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">
            Check again before a repeat booking. New verified incidents may have been reported since
            the last check.
          </Typography>
          <FormError message={error} />
          {result && <MatchResult result={result} />}
          <Box>
            <Button variant="outlined" onClick={() => void recheck()} loading={checking}>
              Check again
            </Button>
          </Box>
        </Stack>
      </Section>

      <NotesSection customerId={customer.id} />

      {membership?.role === 'owner' && (
        <Box>
          <Button color="error" variant="outlined" onClick={() => setConfirming(true)}>
            Delete customer
          </Button>
        </Box>
      )}
      <ConfirmDialog
        open={confirming}
        title={`Delete ${customer.full_name}?`}
        body="Their details and notes are deleted too. Past alerts stay in your alerts list. This can't be undone."
        confirmLabel="Delete customer"
        busy={deleting}
        onConfirm={() => void remove()}
        onCancel={() => setConfirming(false)}
      />
    </Stack>
  );
}
