import { AppBar, Box, Container, Link, Toolbar } from '@mui/material';
import { Outlet, Link as RouterLink } from 'react-router';
import { Logo } from '@ck/brand';
import { AccountMenu } from './AccountMenu';

/** Mobile-first frame: navy header, centered content column, safe-area padding for notches. */
export function AppShell() {
  return (
    <Box sx={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <Link
        href="#main"
        sx={{
          position: 'absolute',
          left: 8,
          top: -48,
          zIndex: 'tooltip',
          p: 1,
          bgcolor: 'background.paper',
          '&:focus': { top: 8 },
        }}
      >
        Skip to main content
      </Link>
      <AppBar
        position="sticky"
        color="secondary"
        elevation={0}
        sx={{ pt: 'env(safe-area-inset-top)' }}
      >
        <Toolbar>
          <RouterLink
            to="/"
            style={{ color: 'inherit', textDecoration: 'none', display: 'inline-flex' }}
          >
            <Logo size={36} withWordmark onDark />
          </RouterLink>
          <Box sx={{ flex: 1 }} />
          <AccountMenu />
        </Toolbar>
      </AppBar>
      <Container
        component="main"
        id="main"
        tabIndex={-1}
        maxWidth="sm"
        sx={{ flex: 1, py: 3, pb: 'calc(24px + env(safe-area-inset-bottom))', outline: 'none' }}
      >
        <Outlet />
      </Container>
    </Box>
  );
}
