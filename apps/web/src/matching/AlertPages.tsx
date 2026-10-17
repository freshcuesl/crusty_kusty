import ChevronRight from '@mui/icons-material/ChevronRight';
import WarningAmberOutlined from '@mui/icons-material/WarningAmberOutlined';
import {
  Box,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router';
import { friendlyError } from '@cs/core';
import { useAuth } from '../auth/AuthProvider';
import { useSupabase } from '../auth/SupabaseProvider';
import { FormError, FullPageSpinner } from '../auth/ui';
import { DECISION_LABELS, type AlertDecision } from './format';
import { MatchResult, type CheckResult } from './MatchResult';

interface AlertRow {
  id: string;
  customer_label: string;
  incident_count: number;
  decision: AlertDecision | null;
  created_at: string;
}

async function fetchAlerts(supabase: SupabaseClient, businessId: string) {
  const { data, error } = await supabase
    .from('match_alerts')
    .select('id, customer_label, incident_count, decision, created_at')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as AlertRow[] | null) ?? [];
}

export function AlertsPage() {
  const supabase = useSupabase();
  const { membership } = useAuth();
  const [rows, setRows] = useState<AlertRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchAlerts(supabase, membership?.businessId ?? '').then(
      (list) => active && setRows(list),
      (thrown: unknown) => active && setError(friendlyError(thrown)),
    );
    return () => {
      active = false;
    };
  }, [supabase, membership?.businessId]);

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h4" component="h1">
          Alerts
        </Typography>
        <Typography color="text.secondary">
          Customers you checked who match verified incidents. Only your business sees these.
        </Typography>
      </Box>
      <FormError message={error} />
      {rows && rows.length === 0 && (
        <Typography>
          No alerts yet. Checks with no verified incidents don't create alerts.
        </Typography>
      )}
      {rows && rows.length > 0 && (
        <Paper variant="outlined">
          <List aria-label="Alerts" disablePadding>
            {rows.map((row) => (
              <ListItemButton key={row.id} component={RouterLink} to={`/alerts/${row.id}`} divider>
                <ListItemIcon>
                  <WarningAmberOutlined sx={{ color: 'warning.main' }} aria-hidden="true" />
                </ListItemIcon>
                <ListItemText
                  primary={row.customer_label}
                  secondary={`${row.incident_count} verified ${
                    row.incident_count === 1 ? 'incident' : 'incidents'
                  } · ${row.decision ? DECISION_LABELS[row.decision] : 'No decision yet'} · ${new Date(
                    row.created_at,
                  ).toLocaleDateString()}`}
                />
                <ChevronRight aria-hidden="true" />
              </ListItemButton>
            ))}
          </List>
        </Paper>
      )}
    </Stack>
  );
}

interface AlertDetails extends CheckResult {
  customer_label: string;
  decision: AlertDecision | null;
}

export function AlertDetailPage() {
  const { id = '' } = useParams();
  const supabase = useSupabase();
  const [details, setDetails] = useState<AlertDetails | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    supabase.rpc('alert_details', { p_alert_id: id }).then(
      ({ data, error: rpcError }) => {
        if (!active) return;
        if (rpcError) setError(friendlyError(rpcError));
        else setDetails(data as AlertDetails);
      },
      (thrown: unknown) => active && setError(friendlyError(thrown)),
    );
    return () => {
      active = false;
    };
  }, [supabase, id]);

  if (!details) return error ? <FormError message={error} /> : <FullPageSpinner />;

  return (
    <Stack spacing={3}>
      <Typography variant="h4" component="h1">
        Alert for {details.customer_label}
      </Typography>
      <MatchResult result={{ ...details, alert_id: id }} initialDecision={details.decision} />
    </Stack>
  );
}
