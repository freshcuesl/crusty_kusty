import OpenInNewOutlined from '@mui/icons-material/OpenInNewOutlined';
import {
  Alert,
  Box,
  Button,
  Grid,
  Link,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useTheme,
} from '@mui/material';
import { BarChart } from '@mui/x-charts/BarChart';
import { useEffect, useId, useState, type ReactNode } from 'react';
import { Title, usePermissions } from 'react-admin';
import { brand } from '@cs/brand';
import { friendlyError } from '@cs/core';
import { useAdminSupabase } from '../AdminSupabase';
import { AdminMiles } from './AdminMiles';

interface Week {
  week: string;
  signups: number;
  verified: number;
  checks: number;
  alerts: number;
  incidents_submitted: number;
  incidents_verified: number;
}

interface Finances {
  paying: number;
  mrr_cents: number;
  arr_cents: number;
  stripe_trialing: number;
  trials_ending_7d: number;
  past_due: number;
  canceling: number;
  trial_conversion: { ended: number; converted: number };
  plan_mix: Record<'free' | 'pro' | 'team' | 'business', number>;
}

export interface Insights {
  generated_at: string;
  totals: {
    businesses: number;
    verified_businesses: number;
    users: number;
    active_incidents: number;
    checks_30d: number;
    alerts_30d: number;
  };
  weekly: Week[];
  decisions: Record<
    'continue_booking' | 'require_authorization' | 'decline_job' | 'undecided',
    number
  >;
  moderation: {
    businesses_waiting: number;
    incidents_waiting: number;
    open_flags: number;
    median_incident_review_hours: number | null;
    oldest_incident_waiting_hours: number | null;
  };
  finances: Finances | null;
}

const TRENDS: { key: keyof Omit<Week, 'week'>; title: string; column: string }[] = [
  { key: 'signups', title: 'New businesses per week', column: 'Sign-ups' },
  { key: 'verified', title: 'Businesses verified per week', column: 'Verified' },
  { key: 'checks', title: 'Customer checks per week', column: 'Checks' },
  { key: 'alerts', title: 'Alerts per week', column: 'Alerts' },
  { key: 'incidents_submitted', title: 'Incidents submitted per week', column: 'Submitted' },
  { key: 'incidents_verified', title: 'Incidents verified per week', column: 'Verified incidents' },
];

const RANGES = [12, 26, 52];

const count = new Intl.NumberFormat('en-US');
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const dollars = (cents: number) => money.format(cents / 100);
const hours = (value: number | null) => (value === null ? '–' : `${value} h`);

/** "2026-10-05" → "Oct 5" (weeks start on Monday, in UTC). */
function weekLabel(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <Paper component="section" aria-labelledby={id} variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1}
        sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' }, mb: 2 }}
      >
        <Typography id={id} variant="h6" component="h2">
          {title}
        </Typography>
        {action}
      </Stack>
      {children}
    </Paper>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <Box>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography
        variant="h4"
        component="p"
        sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}
      >
        {value}
      </Typography>
      {note && (
        <Typography variant="body2" color="text.secondary">
          {note}
        </Typography>
      )}
    </Box>
  );
}

function StatGrid({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        display: 'grid',
        gap: 3,
        gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(3, 1fr)', lg: 'repeat(6, 1fr)' },
      }}
    >
      {children}
    </Box>
  );
}

/** One measure per chart (small multiples): no shared axis, no legend needed. */
function TrendChart({
  weeks,
  metric,
  title,
}: {
  weeks: Week[];
  metric: keyof Omit<Week, 'week'>;
  title: string;
}) {
  const dark = useTheme().palette.mode === 'dark';
  const captionId = useId();
  const latest = weeks.at(-1)?.[metric] ?? 0;
  return (
    <Box component="figure" aria-labelledby={captionId} sx={{ m: 0 }}>
      <Typography id={captionId} component="figcaption" variant="subtitle2">
        {title}
        <Typography component="span" variant="body2" color="text.secondary">
          {' '}
          · this week {count.format(latest)}
        </Typography>
      </Typography>
      <BarChart
        height={180}
        margin={{ left: 8, right: 8, top: 12, bottom: 4 }}
        borderRadius={4}
        grid={{ horizontal: true }}
        hideLegend
        xAxis={[
          {
            scaleType: 'band',
            data: weeks.map((w) => weekLabel(w.week)),
            categoryGapRatio: 0.35,
            tickLabelStyle: { fontSize: 11 },
          },
        ]}
        yAxis={[{ width: 32, tickMinStep: 1, tickLabelStyle: { fontSize: 11 } }]}
        series={[
          {
            data: weeks.map((w) => w[metric]),
            label: title.replace(' per week', ''),
            color: dark ? brand.chartDark : brand.chart,
          },
        ]}
      />
    </Box>
  );
}

function TrendTable({ weeks }: { weeks: Week[] }) {
  return (
    <Box sx={{ overflowX: 'auto' }}>
      <Table size="small" aria-label="Weekly trends">
        <TableHead>
          <TableRow>
            <TableCell>Week of</TableCell>
            {TRENDS.map((t) => (
              <TableCell key={t.key} align="right">
                {t.column}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {weeks.map((w) => (
            <TableRow key={w.week}>
              <TableCell>{weekLabel(w.week)}</TableCell>
              {TRENDS.map((t) => (
                <TableCell key={t.key} align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                  {count.format(w[t.key])}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
}

/** Label, number and a thin bar showing its share. Text carries the value, so color is never alone. */
function ShareRows({ rows, label }: { rows: { name: string; value: number }[]; label: string }) {
  const dark = useTheme().palette.mode === 'dark';
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <Table size="small" aria-label={label}>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.name}>
            <TableCell component="th" scope="row" sx={{ width: '40%', border: 0, pl: 0 }}>
              {row.name}
            </TableCell>
            <TableCell
              align="right"
              sx={{ width: 64, border: 0, fontVariantNumeric: 'tabular-nums' }}
            >
              {count.format(row.value)}
            </TableCell>
            <TableCell sx={{ border: 0, pr: 0 }}>
              <Box
                aria-hidden="true"
                sx={{
                  height: 12,
                  width: `${(row.value / max) * 100}%`,
                  minWidth: row.value > 0 ? 4 : 0,
                  bgcolor: dark ? brand.chartDark : brand.chart,
                  borderRadius: '0 4px 4px 0',
                }}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function FinancesSection({ finances }: { finances: Finances }) {
  const { ended, converted } = finances.trial_conversion;
  const rate = ended > 0 ? Math.round((converted / ended) * 100) : null;
  return (
    <Section
      title="Finances"
      action={
        <Link
          href="https://dashboard.stripe.com/"
          target="_blank"
          rel="noopener noreferrer"
          sx={{ display: 'inline-flex', gap: 0.5, alignItems: 'center' }}
        >
          Open Stripe for payouts and refunds{' '}
          <OpenInNewOutlined fontSize="small" aria-hidden="true" />
        </Link>
      }
    >
      <Stack spacing={3}>
        <StatGrid>
          <Stat label="Monthly recurring revenue" value={dollars(finances.mrr_cents)} />
          <Stat label="Yearly run rate" value={dollars(finances.arr_cents)} />
          <Stat label="Paying businesses" value={count.format(finances.paying)} />
          <Stat
            label="Trial conversion"
            value={rate === null ? '–' : `${rate}%`}
            note={`${converted} of ${ended} trials became paid plans`}
          />
          <Stat label="Trials ending this week" value={count.format(finances.trials_ending_7d)} />
          <Stat
            label="Need attention"
            value={count.format(finances.past_due + finances.canceling)}
            note={`${finances.past_due} failed payment, ${finances.canceling} canceling`}
          />
        </StatGrid>
        <Box>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Businesses by plan
          </Typography>
          <ShareRows
            label="Businesses by plan"
            rows={[
              { name: 'Free', value: finances.plan_mix.free },
              { name: 'Pro', value: finances.plan_mix.pro },
              { name: 'Team', value: finances.plan_mix.team },
              { name: 'Business', value: finances.plan_mix.business },
            ]}
          />
        </Box>
        <Typography variant="body2" color="text.secondary">
          Revenue counts active and past-due subscriptions; yearly plans count as a twelfth each
          month. Stripe has the exact amounts after fees and refunds.
        </Typography>
      </Stack>
    </Section>
  );
}

export function InsightsPage() {
  const supabase = useAdminSupabase();
  const { permissions } = usePermissions();
  const [weeks, setWeeks] = useState(12);
  const [data, setData] = useState<Insights | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [asTable, setAsTable] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.rpc('admin_insights', { p_weeks: weeks }).then(
      ({ data: result, error: rpcError }) => {
        if (!active) return;
        if (rpcError) setError(friendlyError(rpcError));
        else setData(result as Insights);
      },
      (thrown: unknown) => active && setError(friendlyError(thrown)),
    );
    return () => {
      active = false;
    };
  }, [supabase, weeks]);

  return (
    <Stack spacing={3} sx={{ py: 3 }}>
      <Title title="Insights" />
      <Box>
        <Typography variant="h4" component="h1">
          Insights
        </Typography>
        <Typography color="text.secondary">
          Counted inside the database. No customer details are shown here.
        </Typography>
        <Box sx={{ mt: 2 }}>
          <AdminMiles />
        </Box>
      </Box>
      {error && <Alert severity="error">{error}</Alert>}
      {data && (
        <>
          <Section title="At a glance">
            <StatGrid>
              <Stat label="Businesses" value={count.format(data.totals.businesses)} />
              <Stat
                label="Verified businesses"
                value={count.format(data.totals.verified_businesses)}
              />
              <Stat label="Users" value={count.format(data.totals.users)} />
              <Stat
                label="Active verified incidents"
                value={count.format(data.totals.active_incidents)}
              />
              <Stat label="Checks, last 30 days" value={count.format(data.totals.checks_30d)} />
              <Stat label="Alerts, last 30 days" value={count.format(data.totals.alerts_30d)} />
            </StatGrid>
          </Section>

          {data.finances && permissions === 'admin' && <FinancesSection finances={data.finances} />}

          <Section
            title="Weekly trends"
            action={
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <ToggleButtonGroup
                  exclusive
                  size="small"
                  value={weeks}
                  onChange={(_, value: number | null) => value && setWeeks(value)}
                  aria-label="Time range"
                  sx={{ '& .MuiToggleButton-root': { color: 'text.primary' } }}
                >
                  {RANGES.map((n) => (
                    <ToggleButton key={n} value={n}>
                      {n} weeks
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>
                <Button size="small" onClick={() => setAsTable((v) => !v)}>
                  {asTable ? 'Show as charts' : 'Show as table'}
                </Button>
              </Stack>
            }
          >
            {asTable ? (
              <TrendTable weeks={data.weekly} />
            ) : (
              <Grid container spacing={3}>
                {TRENDS.map((t) => (
                  <Grid key={t.key} size={{ xs: 12, md: 6, xl: 4 }}>
                    <TrendChart weeks={data.weekly} metric={t.key} title={t.title} />
                  </Grid>
                ))}
              </Grid>
            )}
          </Section>

          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Section title="After an alert">
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  What businesses chose, last 90 days.
                </Typography>
                <ShareRows
                  label="Decisions after an alert"
                  rows={[
                    { name: 'Continue booking', value: data.decisions.continue_booking },
                    { name: 'Require authorization', value: data.decisions.require_authorization },
                    { name: 'Decline job', value: data.decisions.decline_job },
                    { name: 'No decision yet', value: data.decisions.undecided },
                  ]}
                />
              </Section>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Section title="Moderation">
                <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: '1fr 1fr' }}>
                  <Stat
                    label="Incidents waiting"
                    value={count.format(data.moderation.incidents_waiting)}
                  />
                  <Stat
                    label="Businesses waiting"
                    value={count.format(data.moderation.businesses_waiting)}
                  />
                  <Stat label="Open abuse flags" value={count.format(data.moderation.open_flags)} />
                  <Stat
                    label="Median incident review"
                    value={hours(data.moderation.median_incident_review_hours)}
                    note={`Oldest waiting: ${hours(data.moderation.oldest_incident_waiting_hours)}`}
                  />
                </Box>
              </Section>
            </Grid>
          </Grid>
        </>
      )}
    </Stack>
  );
}
