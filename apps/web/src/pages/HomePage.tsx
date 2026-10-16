import ChevronRight from '@mui/icons-material/ChevronRight';
import LockOutlined from '@mui/icons-material/LockOutlined';
import { Alert, Box, Button, Card, CardActionArea, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router';
import { useAuth } from '../auth/AuthProvider';
import { InstallBanner } from '../pwa/InstallBanner';
import { homeActions } from '../routes';

export function HomePage() {
  const { membership } = useAuth();
  const verified = membership?.verificationStatus === 'verified';

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h4" component="h1">
          What do you need?
        </Typography>
        <Typography color="text.secondary">
          {membership?.businessName ?? 'Verified facts, not labels.'}
        </Typography>
      </Box>

      {membership && !verified && (
        <Alert
          severity="warning"
          role="status"
          action={
            <Button component={RouterLink} to="/verification" color="inherit" size="small">
              Verify now
            </Button>
          }
        >
          Your business isn't verified yet. Customer checks and incident reports unlock once it is.
        </Alert>
      )}

      <Stack component="nav" aria-label="Main actions" spacing={1.5}>
        {homeActions.map(({ label, description, path, icon: Icon, primary, needsVerification }) => {
          const locked = needsVerification && !verified;
          const highlight = primary && !locked;
          return (
            <Card
              key={path}
              variant="outlined"
              sx={
                highlight
                  ? {
                      bgcolor: 'primary.main',
                      color: 'primary.contrastText',
                      borderColor: 'primary.main',
                    }
                  : undefined
              }
            >
              <CardActionArea
                component={RouterLink}
                to={locked ? '/verification' : path}
                sx={{ p: 2, minHeight: 72 }}
              >
                <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                  {locked ? <LockOutlined aria-hidden="true" /> : <Icon aria-hidden="true" />}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 600 }}>{label}</Typography>
                    <Typography
                      variant="body2"
                      sx={{ color: highlight ? 'inherit' : 'text.secondary' }}
                    >
                      {locked ? 'Unlocks after verification' : description}
                    </Typography>
                  </Box>
                  <ChevronRight aria-hidden="true" />
                </Stack>
              </CardActionArea>
            </Card>
          );
        })}
      </Stack>

      <InstallBanner />
    </Stack>
  );
}
