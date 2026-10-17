import { Alert, Box, Stack, Typography } from '@mui/material';
import { useNavigate } from 'react-router';
import { friendlyError } from '@cs/core';
import { useSupabase } from '../auth/SupabaseProvider';
import { IncidentForm } from './IncidentForm';

export function ReportIncidentPage() {
  const supabase = useSupabase();
  const navigate = useNavigate();

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h4" component="h1">
          Report incident
        </Typography>
        <Typography color="text.secondary">
          A case file, not an accusation. A moderator confirms the facts before anyone is alerted.
        </Typography>
      </Box>
      <Alert severity="info" role="status">
        Stick to facts you can show with evidence: dates, invoices, photos and messages. Next you'll
        add that evidence, then submit for review.
      </Alert>
      <IncidentForm
        submitLabel="Save and add evidence"
        onSave={async (payload) => {
          try {
            const { data, error } = await supabase.rpc('create_incident', payload);
            if (error) return friendlyError(error);
            navigate(`/incidents/${data as string}`);
            return null;
          } catch (thrown) {
            return friendlyError(thrown);
          }
        }}
      />
    </Stack>
  );
}
