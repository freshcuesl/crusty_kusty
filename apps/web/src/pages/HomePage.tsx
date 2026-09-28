import ChevronRight from '@mui/icons-material/ChevronRight';
import { Box, Card, CardActionArea, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router';
import { InstallBanner } from '../pwa/InstallBanner';
import { homeActions } from '../routes';

export function HomePage() {
  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h4" component="h1">
          What do you need?
        </Typography>
        <Typography color="text.secondary">Verified facts, not labels.</Typography>
      </Box>

      <Stack component="nav" aria-label="Main actions" spacing={1.5}>
        {homeActions.map(({ label, description, path, icon: Icon, primary }) => (
          <Card
            key={path}
            variant="outlined"
            sx={
              primary
                ? {
                    bgcolor: 'primary.main',
                    color: 'primary.contrastText',
                    borderColor: 'primary.main',
                  }
                : undefined
            }
          >
            <CardActionArea component={RouterLink} to={path} sx={{ p: 2, minHeight: 72 }}>
              <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                <Icon aria-hidden="true" />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 600 }}>{label}</Typography>
                  <Typography
                    variant="body2"
                    sx={{ color: primary ? 'inherit' : 'text.secondary' }}
                  >
                    {description}
                  </Typography>
                </Box>
                <ChevronRight aria-hidden="true" />
              </Stack>
            </CardActionArea>
          </Card>
        ))}
      </Stack>

      <InstallBanner />
    </Stack>
  );
}
