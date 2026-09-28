import { Button, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router';
import { Logo } from '@ck/brand';

export function NotFoundPage() {
  return (
    <Stack spacing={2} sx={{ alignItems: 'center', textAlign: 'center', py: 6 }}>
      <Logo size={120} decorative />
      <Typography variant="h4" component="h1">
        Page not found
      </Typography>
      <Typography color="text.secondary">This crab looked everywhere. Nothing here.</Typography>
      <Button component={RouterLink} to="/" variant="contained">
        Go home
      </Button>
    </Stack>
  );
}
