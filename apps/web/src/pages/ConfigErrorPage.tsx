import { Alert, Container, Stack, Typography } from '@mui/material';
import { Logo } from '@ck/brand';

/** Shown instead of the app when it isn't connected to Supabase, with the fix. */
export function ConfigErrorPage({ message }: { message: string }) {
  return (
    <Container component="main" maxWidth="sm" sx={{ py: 6 }}>
      <Stack spacing={3} sx={{ alignItems: 'flex-start' }}>
        <Logo size={64} withWordmark />
        <Typography variant="h4" component="h1">
          The app isn't connected yet
        </Typography>
        <Alert severity="warning" sx={{ width: '100%' }}>
          {message}
        </Alert>
        <Typography>
          In the terminal, run <code>npm run db:start</code>, then <code>npm run setup:env</code>,
          then restart <code>npm run dev</code>.
        </Typography>
      </Stack>
    </Container>
  );
}
