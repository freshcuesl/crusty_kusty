import { Alert, Box, Button, LinearProgress, Paper, Stack, Typography } from '@mui/material';
import { useId, useState } from 'react';
import { useSearchParams } from 'react-router';
import { friendlyError, functionErrorMessage } from '@cs/core';
import { useSupabase } from '../auth/SupabaseProvider';
import { FormError, FullPageSpinner } from '../auth/ui';
import { redirectTo } from '../verification/redirect';
import { IntervalToggle, PlanCard, PlanGrid } from './PlanCards';
import { PLANS } from './plans';
import {
  daysLeft,
  isOnTrial,
  isPaid,
  useSubscription,
  type Interval,
  type Subscription,
} from './subscription';

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });

function CurrentPlan({ sub }: { sub: Subscription }) {
  const headingId = useId();
  const trial = isOnTrial(sub);
  const paid = isPaid(sub);
  const used = sub.monthly_checks ? Math.min(100, (sub.checks_used / sub.monthly_checks) * 100) : 0;

  return (
    <Paper
      component="section"
      aria-labelledby={headingId}
      variant="outlined"
      sx={{ p: { xs: 2, sm: 3 } }}
    >
      <Typography variant="overline" id={headingId} component="h2">
        Your plan
      </Typography>
      <Typography variant="h5" component="p" sx={{ fontWeight: 700 }}>
        {trial ? `${sub.plan_name} free trial` : sub.plan_name}
      </Typography>
      <Stack spacing={1} sx={{ mt: 1 }}>
        {trial && sub.trial_ends_at && (
          <Typography>
            Trial ends {formatDate(sub.trial_ends_at)} ({daysLeft(sub.trial_ends_at)} days left).
            After that you move to Free unless you choose a plan.
          </Typography>
        )}
        {paid && sub.billing_interval && (
          <Typography>Billed {sub.billing_interval === 'year' ? 'yearly' : 'monthly'}</Typography>
        )}
        {paid && sub.current_period_end && (
          <Typography>
            {sub.cancel_at_period_end ? 'Ends' : 'Renews'} on {formatDate(sub.current_period_end)}
          </Typography>
        )}
        {sub.status === 'past_due' && (
          <Alert severity="warning" role="status">
            Your last payment didn&apos;t go through. Update your card in Manage billing to keep
            your plan.
          </Alert>
        )}
        {sub.monthly_checks ? (
          <Box>
            <Typography>
              {sub.checks_used} of {sub.monthly_checks} checks used this month
            </Typography>
            <LinearProgress
              variant="determinate"
              value={used}
              color={used >= 100 ? 'warning' : 'primary'}
              aria-label="Checks used this month"
              sx={{ mt: 0.5, height: 8, borderRadius: 4 }}
            />
          </Box>
        ) : (
          <Typography>Unlimited checks</Typography>
        )}
        <Typography>
          {sub.members} of {sub.max_members} {sub.max_members === 1 ? 'user' : 'users'}
        </Typography>
      </Stack>
    </Paper>
  );
}

export function BillingPage() {
  const supabase = useSupabase();
  const [params] = useSearchParams();
  const { subscription: sub, error: loadError } = useSubscription();
  const [interval, setInterval] = useState<Interval>('month');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const open = async (fn: string, key: string, body?: Record<string, string>) => {
    setError(null);
    setBusy(key);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke<{ url: string }>(fn, {
        method: 'POST',
        ...(body ? { body } : {}),
      });
      if (invokeError || !data?.url) {
        setError(await functionErrorMessage(invokeError));
        return;
      }
      redirectTo(data.url);
    } catch (thrown) {
      setError(friendlyError(thrown));
    } finally {
      setBusy(null);
    }
  };

  if (!sub) return loadError ? <FormError message={loadError} /> : <FullPageSpinner />;

  const paid = isPaid(sub);
  const trial = isOnTrial(sub);
  const canChoose = sub.can_manage && !paid;

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h4" component="h1">
          Plan and billing
        </Typography>
        <Typography color="text.secondary">
          One avoided chargeback can pay for a year of ClientShield.
        </Typography>
      </Box>

      {params.get('checkout') === 'success' && (
        <Alert severity="success" role="status">
          Thanks! Your plan is active. It can take a few seconds to show here.
        </Alert>
      )}

      <CurrentPlan sub={sub} />
      <FormError message={error} />

      {sub.can_manage && sub.has_billing_account && (
        <Box>
          <Button
            variant="outlined"
            onClick={() => void open('create-billing-portal', 'portal')}
            loading={busy === 'portal'}
          >
            Manage billing
          </Button>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Change plan, update your card, download invoices or cancel. Opens Stripe&apos;s secure
            billing page.
          </Typography>
        </Box>
      )}

      {!sub.can_manage && (
        <Alert severity="info" role="status">
          Only the business owner can change the plan.
        </Alert>
      )}

      <Stack spacing={2}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between' }}
        >
          <Typography variant="h6" component="h2">
            Plans
          </Typography>
          <IntervalToggle value={interval} onChange={setInterval} />
        </Stack>
        {canChoose && trial && (
          <Typography variant="body2" color="text.secondary">
            Choose a plan now and you won&apos;t be charged until your trial ends.
          </Typography>
        )}
        <PlanGrid>
          {PLANS.map((plan) => {
            const buyable = plan.tier === 'pro' || plan.tier === 'team';
            return (
              <PlanCard
                key={plan.tier}
                plan={plan}
                interval={interval}
                badge={plan.tier === sub.tier ? 'Current' : undefined}
                highlight={plan.tier === sub.tier}
                action={
                  canChoose && buyable ? (
                    <Button
                      variant={plan.tier === 'pro' ? 'contained' : 'outlined'}
                      onClick={() =>
                        void open('create-checkout-session', plan.tier, {
                          plan: plan.tier,
                          interval,
                        })
                      }
                      loading={busy === plan.tier}
                    >
                      Choose {plan.name}
                    </Button>
                  ) : null
                }
              />
            );
          })}
        </PlanGrid>
        <Typography variant="body2" color="text.secondary">
          Prices in US dollars. Every plan keeps the 300-checks-a-day fair-use limit.
        </Typography>
      </Stack>
    </Stack>
  );
}
