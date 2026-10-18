import FactCheckOutlined from '@mui/icons-material/FactCheckOutlined';
import FlagOutlined from '@mui/icons-material/FlagOutlined';
import StorefrontOutlined from '@mui/icons-material/StorefrontOutlined';
import { Card, CardActionArea, CardContent, Grid, Stack, Typography } from '@mui/material';
import type { SvgIconComponent } from '@mui/icons-material';
import { Title, useGetList } from 'react-admin';
import { Link as RouterLink } from 'react-router-dom';
import { DashboardOverview } from './DashboardOverview';

interface Queue {
  title: string;
  description: string;
  icon: SvgIconComponent;
  /** The queue's list page and what counts as "waiting" there; absent until built. */
  live?: {
    to: string;
    resource: string;
    filter: Record<string, string>;
    sortField: string;
    /** Word after the count, e.g. "3 waiting". */
    word?: string;
  };
}

const queues: Queue[] = [
  {
    title: 'Business verifications',
    description: 'Confirm new contractors are real, operating businesses.',
    icon: StorefrontOutlined,
    live: {
      to: '/businesses',
      resource: 'businesses',
      filter: { verification_status: 'pending' },
      sortField: 'submitted_at',
    },
  },
  {
    title: 'Incident review',
    description: 'Confirm the job happened, the dispute happened, and the evidence exists.',
    icon: FactCheckOutlined,
    live: {
      to: '/incidents',
      resource: 'incidents',
      filter: { status: 'submitted' },
      sortField: 'submitted_at',
    },
  },
  {
    title: 'Abuse flags',
    description: 'Businesses checking or reporting far more customers than normal.',
    icon: FlagOutlined,
    live: {
      to: '/abuse_flags',
      resource: 'abuse_flags',
      filter: { 'resolved_at@is': 'null' },
      sortField: 'created_at',
      word: 'open',
    },
  },
];

function QueueContent({ queue, footer }: { queue: Queue; footer: string }) {
  const Icon = queue.icon;
  return (
    <CardContent>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 1 }}>
        <Icon color="primary" aria-hidden="true" />
        <Typography variant="h6" component="h2">
          {queue.title}
        </Typography>
      </Stack>
      <Typography color="text.secondary">{queue.description}</Typography>
      <Typography variant="body2" sx={{ mt: 2, fontWeight: 600 }}>
        {footer}
      </Typography>
    </CardContent>
  );
}

function LiveQueue({ queue, live }: { queue: Queue; live: NonNullable<Queue['live']> }) {
  const { total } = useGetList(live.resource, {
    filter: live.filter,
    pagination: { page: 1, perPage: 1 },
    sort: { field: live.sortField, order: 'ASC' },
  });
  return (
    <CardActionArea component={RouterLink} to={live.to} sx={{ height: '100%' }}>
      <QueueContent queue={queue} footer={`${total ?? 0} ${live.word ?? 'waiting'}`} />
    </CardActionArea>
  );
}

export function Dashboard() {
  return (
    <Stack spacing={3} sx={{ py: 3 }}>
      <Title title="Moderation" />
      <Typography variant="h4" component="h1">
        Moderation
      </Typography>
      <DashboardOverview />
      <Grid container spacing={2}>
        {queues.map((queue) => (
          <Grid key={queue.title} size={{ xs: 12, md: 4 }}>
            <Card variant="outlined" sx={{ height: '100%' }}>
              {queue.live ? (
                <LiveQueue queue={queue} live={queue.live} />
              ) : (
                <QueueContent queue={queue} footer="Coming soon" />
              )}
            </Card>
          </Grid>
        ))}
      </Grid>
    </Stack>
  );
}
