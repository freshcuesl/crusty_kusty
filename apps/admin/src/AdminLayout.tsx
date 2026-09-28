import { Box, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import { AppBar, Layout, TitlePortal } from 'react-admin';
import { Logo } from '@ck/brand';

function BrandAppBar() {
  return (
    <AppBar color="secondary">
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mr: 2 }}>
        <Logo size={32} />
        <Typography variant="h6" component="span" sx={{ fontWeight: 600 }}>
          Admin
        </Typography>
      </Box>
      <TitlePortal />
    </AppBar>
  );
}

export function AdminLayout({ children }: { children: ReactNode }) {
  return <Layout appBar={BrandAppBar}>{children}</Layout>;
}
