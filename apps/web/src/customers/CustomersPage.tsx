import ChevronRight from '@mui/icons-material/ChevronRight';
import PersonOutlined from '@mui/icons-material/PersonOutlined';
import {
  Box,
  Button,
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
import { Link as RouterLink } from 'react-router';
import { formatUsPhone, friendlyError } from '@cs/core';
import { useAuth } from '../auth/AuthProvider';
import { useSupabase } from '../auth/SupabaseProvider';
import { FormError } from '../auth/ui';

interface CustomerSummary {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  city: string | null;
}

async function fetchCustomers(supabase: SupabaseClient, businessId: string) {
  const { data, error } = await supabase
    .from('customers')
    .select('id, full_name, phone, email, city')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as CustomerSummary[] | null) ?? [];
}

export function CustomersPage() {
  const supabase = useSupabase();
  const { membership } = useAuth();
  const [rows, setRows] = useState<CustomerSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchCustomers(supabase, membership?.businessId ?? '').then(
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
          Customers
        </Typography>
        <Typography color="text.secondary">
          Your saved customers and private notes. Only people in your business see these.
        </Typography>
      </Box>
      <FormError message={error} />
      {rows && rows.length === 0 && (
        <Stack spacing={2} sx={{ alignItems: 'flex-start' }}>
          <Typography>No saved customers yet. Add one from a new booking.</Typography>
          <Button variant="contained" component={RouterLink} to="/customers/new">
            New customer
          </Button>
        </Stack>
      )}
      {rows && rows.length > 0 && (
        <Paper variant="outlined">
          <List aria-label="Customers" disablePadding>
            {rows.map((row) => (
              <ListItemButton
                key={row.id}
                component={RouterLink}
                to={`/customers/${row.id}`}
                divider
              >
                <ListItemIcon>
                  <PersonOutlined aria-hidden="true" />
                </ListItemIcon>
                <ListItemText
                  primary={row.full_name}
                  secondary={[row.phone && formatUsPhone(row.phone), row.email, row.city]
                    .filter(Boolean)
                    .join(' · ')}
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
