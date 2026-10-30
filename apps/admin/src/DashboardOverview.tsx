import { Box, Button, Card, CardContent, Grid, Stack, Typography, useTheme } from '@mui/material';
import { SparkLineChart } from '@mui/x-charts/SparkLineChart';
import { useEffect, useId, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { brand } from '@cs/brand';
import { useAdminSupabase } from './AdminSupabase';
import type { Insights } from './insights/InsightsPage';

const count = new Intl.NumberFormat('en-US');

interface Tile {
  label: string;
  value: number;
  note?: string;
  trend: number[];
  trendLabel: string;
}

function StatTile({ tile }: { tile: Tile }) {
  const labelId = useId();
  const dark = useTheme().palette.mode === 'dark';
  return (
    <Card variant="outlined" role="group" aria-labelledby={labelId} sx={{ height: '100%' }}>
      <CardContent>
        <Typography id={labelId} variant="body2" color="text.secondary">
          {tile.label}
        </Typography>
        <Stack direction="row" spacing={2} sx={{ alignItems: 'flex-end', mt: 0.5 }}>
          <Box sx={{ flex: 1 }}>
            <Typography
              variant="h4"
              component="p"
              sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}
            >
              {count.format(tile.value)}
            </Typography>
            {tile.note && (
              <Typography variant="body2" color="text.secondary">
                {tile.note}
              </Typography>
            )}
          </Box>
          <Box role="img" aria-label={`${tile.trendLabel}, last 8 weeks: ${tile.trend.join(', ')}`}>
            <SparkLineChart
              data={tile.trend}
              width={96}
              height={40}
              color={dark ? brand.chartDark : brand.chart}
              curve="linear"
              area
            />
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

/** Quick numbers at the top of the dashboard: four tiles with an 8-week trend each. */
export function DashboardOverview() {
  const supabase = useAdminSupabase();
  const headingId = useId();
  const [data, setData] = useState<Insights | null>(null);

  useEffect(() => {
    let active = true;
    supabase.rpc('admin_insights', { p_weeks: 8 }).then(
      ({ data: result, error }) => {
        if (active && !error && result) setData(result as Insights);
      },
      () => {},
    );
    return () => {
      active = false;
    };
  }, [supabase]);

  if (!data?.totals) return null;
  const series = (key: 'signups' | 'checks' | 'alerts' | 'incidents_verified') =>
    data.weekly.map((w) => w[key]);

  const tiles: Tile[] = [
    {
      label: 'Businesses',
      value: data.totals.businesses,
      note: `${count.format(data.totals.verified_businesses)} verified`,
      trend: series('signups'),
      trendLabel: 'New businesses per week',
    },
    {
      label: 'Checks, last 30 days',
      value: data.totals.checks_30d,
      trend: series('checks'),
      trendLabel: 'Customer checks per week',
    },
    {
      label: 'Alerts, last 30 days',
      value: data.totals.alerts_30d,
      trend: series('alerts'),
      trendLabel: 'Alerts per week',
    },
    {
      label: 'Active incidents',
      value: data.totals.active_incidents,
      trend: series('incidents_verified'),
      trendLabel: 'Incidents verified per week',
    },
  ];

  return (
    <Box component="section" aria-labelledby={headingId}>
      <Stack
        direction="row"
        sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}
      >
        <Typography id={headingId} variant="h6" component="h2">
          Overview
        </Typography>
        <Button component={RouterLink} to="/insights" size="small">
          All insights
        </Button>
      </Stack>
      <Grid container spacing={2}>
        {tiles.map((tile) => (
          <Grid key={tile.label} size={{ xs: 12, sm: 6, lg: 3 }}>
            <StatTile tile={tile} />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
