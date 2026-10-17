import CheckOutlined from '@mui/icons-material/CheckOutlined';
import {
  Alert,
  Box,
  Button,
  Chip,
  LinearProgress,
  List,
  ListItem,
  Paper,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { useId, useState } from 'react';
import { useSearchParams } from 'react-router';
import { friendlyError } from '@cs/core';
import { useSupabase } from '../auth/SupabaseProvider';
import { FormError, FullPageSpinner } from '../auth/ui';
import { functionErrorMessage } from '../lib/functionError';
import { redirectTo } from '../verification/redirect';
import {
  daysLeft,
  isOnTrial,
  isPaid,
  useSubscription,
  type Interval,
  type Subscription,
  type Tier,
} from './subscription';

interface PlanInfo {
  tier: Tier;
  name: string;
  /** Dollars per month and per year; null means "Contact us". */
  price: { month: number; year: number } | null;
  features: string[];
}

// Keep in step with scripts/stripe-setup-plans.mjs (prices) and the plans table (limits).
const PLANS: PlanInfo[] = [
  {
    tier: 'free',
    name: 'Free',
    price: { month: 0, year: 0 },
    features: ['10 customer checks a month', '1 user', 'Incident reports and alerts'],
  },
  {
    tier: 'pro',
    name: 'Pro',
    price: { month: 29, year: 290 },
    features: ['Unlimited customer checks', 'Up to 3 users', 'Everything in Free'],
  },
  {
    tier: 'team',
    name: 'Team',
    price: { month: 59, year: 590 },
    features: ['Unlimited customer checks', 'Up to 15 users', 'Everything in Pro'],
  },
  {
    tier: 'business',
    name: 'Business',
    price: null,
    features: ['CRM and API connections', 'More users', 'Contact us to set it up'],
  },
];

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

function PlanCard({
  plan,
  interval,
  current,
  action,
}: {
  plan: PlanInfo;
  interval: Interval;
  current: boolean;
  action: React.ReactNode;
}) {
  const nameId = useId();
  const price = plan.price;
  return (
    <ListItem aria-labelledby={nameId} disablePadding sx={{ display: 'block', height: '100%' }}>
      <Paper
        variant="outlined"
        sx={{
          p: 2,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
          borderColor: current ? 'primary.main' : undefined,
          borderWidth: current ? 2 : 1,
        }}
      >
        <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography id={nameId} variant="h6" component="h3">
            {plan.name}
          </Typography>
          {current && <Chip size="small" color="primary" label="Current" />}
        </Stack>
        <Typography variant="h4" component="p" sx={{ fontWeight: 700 }}>
          {price ? `$${price[interval]}` : 'Contact us'}
          {price && price.month > 0 && (
            <Typography component="span" color="text.secondary">
              {' '}
              / {interval}
            </Typography>
          )}
        </Typography>
        {price && price.month > 0 && interval === 'year' && (
          <Typography variant="body2" color="success.main" sx={{ fontWeight: 600 }}>
            2 months free
          </Typography>
        )}
        <Stack component="ul" spacing={0.5} sx={{ listStyle: 'none', p: 0, m: 0, flex: 1 }}>
          {plan.features.map((feature) => (
            <Stack component="li" key={feature} direction="row" spacing={1}>
              <CheckOutlined fontSize="small" color="primary" aria-hidden="true" />
              <Typography variant="body2">{feature}</Typography>
            </Stack>
          ))}
        </Stack>
        {action}
      </Paper>
    </ListItem>
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
          <ToggleButtonGroup
            exclusive
            size="small"
            value={interval}
            onChange={(_, value: Interval | null) => value && setInterval(value)}
            aria-label="Billing period"
          >
            <ToggleButton value="month">Monthly</ToggleButton>
            <ToggleButton value="year">Yearly</ToggleButton>
          </ToggleButtonGroup>
        </Stack>
        {canChoose && trial && (
          <Typography variant="body2" color="text.secondary">
            Choose a plan now and you won&apos;t be charged until your trial ends.
          </Typography>
        )}
        <List
          aria-label="Plans"
          disablePadding
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(4, 1fr)' },
          }}
        >
          {PLANS.map((plan) => {
            const buyable = plan.tier === 'pro' || plan.tier === 'team';
            return (
              <PlanCard
                key={plan.tier}
                plan={plan}
                interval={interval}
                current={plan.tier === sub.tier}
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
        </List>
        <Typography variant="body2" color="text.secondary">
          Prices in US dollars. Every plan keeps the 300-checks-a-day fair-use limit.
        </Typography>
      </Stack>
    </Stack>
  );
}
