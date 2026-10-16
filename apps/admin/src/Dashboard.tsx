import FactCheckOutlined from '@mui/icons-material/FactCheckOutlined';
import FlagOutlined from '@mui/icons-material/FlagOutlined';
import StorefrontOutlined from '@mui/icons-material/StorefrontOutlined';
import { Card, CardActionArea, CardContent, Grid, Stack, Typography } from '@mui/material';
import type { SvgIconComponent } from '@mui/icons-material';
import { Title, useGetList } from 'react-admin';
import { Link as RouterLink } from 'react-router-dom';

interface Queue {
  title: string;
  description: string;
  icon: SvgIconComponent;
  /** react-admin route for the queue, once it exists. */
  to?: string;
}

const queues: Queue[] = [
  {
    title: 'Business verifications',
    description: 'Confirm new contractors are real, operating businesses.',
    icon: StorefrontOutlined,
    to: '/businesses',
  },
  {
    title: 'Incident review',
    description: 'Confirm the job happened, the dispute happened, and the evidence exists.',
    icon: FactCheckOutlined,
  },
  {
    title: 'Abuse flags',
    description: 'Businesses reporting far more customers than normal.',
    icon: FlagOutlined,
  },
];

function usePendingBusinesses(): number | undefined {
  const { total } = useGetList('businesses', {
    filter: { verification_status: 'pending' },
    pagination: { page: 1, perPage: 1 },
    sort: { field: 'submitted_at', order: 'ASC' },
  });
  return total;
}

export function Dashboard() {
  const pending = usePendingBusinesses();
  return (
    <Stack spacing={3} sx={{ py: 3 }}>
      <Title title="Moderation" />
      <Typography variant="h4" component="h1">
        Moderation
      </Typography>
      <Grid container spacing={2}>
        {queues.map(({ title, description, icon: Icon, to }) => {
          const content = (
            <CardContent>
              <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 1 }}>
                <Icon color="primary" aria-hidden="true" />
                <Typography variant="h6" component="h2">
                  {title}
                </Typography>
              </Stack>
              <Typography color="text.secondary">{description}</Typography>
              <Typography variant="body2" sx={{ mt: 2, fontWeight: 600 }}>
                {to ? `${pending ?? 0} waiting` : 'Coming soon'}
              </Typography>
            </CardContent>
          );
          return (
            <Grid key={title} size={{ xs: 12, md: 4 }}>
              <Card variant="outlined" sx={{ height: '100%' }}>
                {to ? (
                  <CardActionArea component={RouterLink} to={to} sx={{ height: '100%' }}>
                    {content}
                  </CardActionArea>
                ) : (
                  content
                )}
              </Card>
            </Grid>
          );
        })}
      </Grid>
    </Stack>
  );
}
