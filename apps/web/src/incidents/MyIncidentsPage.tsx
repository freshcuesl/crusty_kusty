import ChevronRight from '@mui/icons-material/ChevronRight';
import {
  Box,
  Button,
  Chip,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router';
import {
  CATEGORY_LABELS,
  friendlyError,
  INCIDENT_STATUS_LABELS,
  type IncidentCategory,
  type IncidentStatus,
} from '@cs/core';
import { useAuth } from '../auth/AuthProvider';
import { useSupabase } from '../auth/SupabaseProvider';
import { FormError } from '../auth/ui';

interface IncidentRow {
  id: string;
  category: IncidentCategory;
  status: IncidentStatus;
  service_date: string;
  // One customer per incident; PostgREST returns it as an object, older typings as a list.
  incident_customers?: { full_name: string } | { full_name: string }[] | null;
}

function customerName(row: IncidentRow): string | undefined {
  const c = row.incident_customers;
  return Array.isArray(c) ? c[0]?.full_name : c?.full_name;
}

async function fetchIncidents(supabase: SupabaseClient, businessId: string) {
  const { data, error } = await supabase
    .from('incidents')
    .select('id, category, status, service_date, incident_customers(full_name)')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as unknown as IncidentRow[] | null) ?? [];
}

export function MyIncidentsPage() {
  const supabase = useSupabase();
  const { membership } = useAuth();
  const [rows, setRows] = useState<IncidentRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchIncidents(supabase, membership?.businessId ?? '').then(
      (list) => active && setRows(list),
      (thrown: unknown) => active && setError(friendlyError(thrown)),
    );
    return () => {
      active = false;
    };
  }, [supabase, membership?.businessId]);

  return (
    <Stack spacing={3}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <Typography variant="h4" component="h1" sx={{ flex: 1 }}>
          My incidents
        </Typography>
        {rows && rows.length > 0 && (
          <Button component={RouterLink} to="/incidents/new" variant="contained">
            Report incident
          </Button>
        )}
      </Box>
      <FormError message={error} />
      {rows && rows.length === 0 && (
        <Stack spacing={2} sx={{ alignItems: 'flex-start' }}>
          <Typography>No incidents reported yet.</Typography>
          <Button component={RouterLink} to="/incidents/new" variant="contained">
            Report incident
          </Button>
        </Stack>
      )}
      {rows && rows.length > 0 && (
        <Paper variant="outlined">
          <List aria-label="Incidents" disablePadding>
            {rows.map((row) => (
              <ListItemButton
                key={row.id}
                component={RouterLink}
                to={`/incidents/${row.id}`}
                divider
              >
                <ListItemText
                  primary={CATEGORY_LABELS[row.category]}
                  secondary={[customerName(row), row.service_date].filter(Boolean).join(' · ')}
                />
                <Chip size="small" label={INCIDENT_STATUS_LABELS[row.status]} sx={{ mx: 1 }} />
                <ChevronRight aria-hidden="true" />
              </ListItemButton>
            ))}
          </List>
        </Paper>
      )}
    </Stack>
  );
}
