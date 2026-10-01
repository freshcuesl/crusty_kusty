import ArrowBack from '@mui/icons-material/ArrowBack';
import { Button, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router';
import { Logo } from '@cs/brand';

/** Placeholder for features that later branches will build. */
export function ComingSoonPage({ title }: { title: string }) {
  return (
    <Stack spacing={2} sx={{ alignItems: 'flex-start' }}>
      <Typography variant="h4" component="h1">
        {title}
      </Typography>
      <Logo size={96} decorative />
      <Typography color="text.secondary">This feature is coming soon.</Typography>
      <Button component={RouterLink} to="/" startIcon={<ArrowBack />} variant="outlined">
        Back to home
      </Button>
    </Stack>
  );
}
