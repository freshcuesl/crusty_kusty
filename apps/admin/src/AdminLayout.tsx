import HistoryOutlined from '@mui/icons-material/HistoryOutlined';
import { Box, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import { AppBar, Layout, Menu, TitlePortal } from 'react-admin';
import { Logo } from '@cs/brand';

function BrandAppBar() {
  return (
    <AppBar color="secondary">
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mr: 2 }}>
        <Logo size={32} onDark />
        <Typography variant="h6" component="span" sx={{ fontWeight: 600 }}>
          Admin
        </Typography>
      </Box>
      <TitlePortal />
    </AppBar>
  );
}

function AdminMenu() {
  return (
    <Menu>
      <Menu.DashboardItem />
      <Menu.ResourceItems />
      <Menu.Item to="/retention" primaryText="Retention" leftIcon={<HistoryOutlined />} />
    </Menu>
  );
}

export function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <Layout appBar={BrandAppBar} menu={AdminMenu}>
      {children}
    </Layout>
  );
}
