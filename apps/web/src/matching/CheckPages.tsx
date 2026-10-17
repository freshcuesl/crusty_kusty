import { Box, Button, Stack, Typography } from '@mui/material';
import { useState } from 'react';
import { Link as RouterLink } from 'react-router';
import { friendlyError } from '@cs/core';
import { useSupabase } from '../auth/SupabaseProvider';
import { CustomerForm } from './CustomerForm';
import { MatchResult, type CheckResult } from './MatchResult';

interface CheckPageProps {
  title: string;
  intro: string;
  rpc: 'add_customer' | 'check_customer';
  submitLabel: string;
  againLabel: string;
}

function CheckPage({ title, intro, rpc, submitLabel, againLabel }: CheckPageProps) {
  const supabase = useSupabase();
  const [result, setResult] = useState<(CheckResult & { customer_id?: string }) | null>(null);
  const [round, setRound] = useState(0);

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h4" component="h1">
          {title}
        </Typography>
        <Typography color="text.secondary">{intro}</Typography>
      </Box>
      {result ? (
        <>
          <MatchResult result={result} />
          {result.customer_id && (
            <Button
              variant="contained"
              component={RouterLink}
              to={`/customers/${result.customer_id}`}
            >
              Open customer record
            </Button>
          )}
          <Button
            variant="outlined"
            onClick={() => {
              setResult(null);
              setRound((r) => r + 1);
            }}
          >
            {againLabel}
          </Button>
        </>
      ) : (
        <CustomerForm
          key={round}
          submitLabel={submitLabel}
          onSubmit={async (customer) => {
            try {
              const { data, error } = await supabase.rpc(rpc, { p_customer: customer });
              if (error) return friendlyError(error);
              setResult(data as CheckResult & { customer_id?: string });
              return null;
            } catch (thrown) {
              return friendlyError(thrown);
            }
          }}
        />
      )}
    </Stack>
  );
}

export function NewCustomerPage() {
  return (
    <CheckPage
      title="New customer"
      intro="Add a customer from a new booking. ClientShield checks them automatically and only you see the result."
      rpc="add_customer"
      submitLabel="Add and check customer"
      againLabel="Add another customer"
    />
  );
}

export function CustomerCheckPage() {
  return (
    <CheckPage
      title="Customer check"
      intro="Check a customer without saving them. This is only for customers you already have: a booking, an estimate or a call. There's no searching for people."
      rpc="check_customer"
      submitLabel="Check customer"
      againLabel="Check another customer"
    />
  );
}
