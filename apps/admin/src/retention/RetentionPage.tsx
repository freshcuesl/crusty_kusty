import {
  Alert,
  Button,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { Title, useNotify, usePermissions } from 'react-admin';
import { CATEGORY_LABELS, friendlyError, type IncidentCategory } from '@cs/core';
import { useAdminSupabase } from '../AdminSupabase';

interface Rule {
  category: IncidentCategory;
  months: number;
  updated_at: string;
}

interface RuleRowProps {
  rule: Rule;
  editable: boolean;
  onSaved(): void;
}

function RuleRow({ rule, editable, onSaved }: RuleRowProps) {
  const supabase = useAdminSupabase();
  const notify = useNotify();
  const [months, setMonths] = useState(String(rule.months));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const label = CATEGORY_LABELS[rule.category] ?? rule.category;

  const save = async () => {
    setError(null);
    setBusy(true);
    try {
      const { error: rpcError } = await supabase.rpc('set_retention_months', {
        p_category: rule.category,
        p_months: Number(months),
      });
      if (rpcError) return setError(friendlyError(rpcError));
      notify('Retention saved', { type: 'success' });
      onSaved();
    } catch (thrown) {
      setError(friendlyError(thrown));
    } finally {
      setBusy(false);
    }
  };

  return (
    <TableRow>
      <TableCell>{label}</TableCell>
      <TableCell>
        {editable ? (
          <Stack spacing={1}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <TextField
                type="number"
                size="small"
                value={months}
                onChange={(e) => setMonths(e.target.value)}
                slotProps={{ htmlInput: { min: 6, max: 60, 'aria-label': `Months for ${label}` } }}
                sx={{ width: 110 }}
              />
              <Button
                variant="outlined"
                onClick={() => void save()}
                loading={busy}
                aria-label={`Save ${label}`}
              >
                Save
              </Button>
            </Stack>
            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        ) : (
          `${rule.months} months`
        )}
      </TableCell>
    </TableRow>
  );
}

/** How long verified incidents count in customer checks, by dispute type. */
export function RetentionPage() {
  const supabase = useAdminSupabase();
  const { permissions } = usePermissions();
  const [rules, setRules] = useState<Rule[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    () =>
      supabase
        .from('retention_rules')
        .select('category, months, updated_at')
        .order('category')
        .then(({ data, error: loadError }) => {
          if (loadError) setError(friendlyError(loadError));
          else setRules((data as Rule[] | null) ?? []);
        }),
    [supabase],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const editable = permissions === 'admin';

  return (
    <Stack spacing={2} sx={{ py: 3 }}>
      <Title title="Retention" />
      <Typography variant="h4" component="h1">
        Retention
      </Typography>
      <Typography color="text.secondary">
        How long a verified incident counts in customer checks. When it expires, a nightly job
        deletes its customer details and evidence. Changes apply to incidents verified from now on.
      </Typography>
      {!editable && (
        <Alert severity="info">
          Only admins can change these. Ask an admin if one looks wrong.
        </Alert>
      )}
      {error && <Alert severity="error">{error}</Alert>}
      <Paper variant="outlined">
        <Table aria-label="Retention rules">
          <TableHead>
            <TableRow>
              <TableCell>Dispute</TableCell>
              <TableCell>Kept for</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rules.map((rule) => (
              <RuleRow
                key={rule.category}
                rule={rule}
                editable={editable}
                onSaved={() => void load()}
              />
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Stack>
  );
}
