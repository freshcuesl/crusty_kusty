import ArrowBackOutlined from '@mui/icons-material/ArrowBackOutlined';
import HistoryOutlined from '@mui/icons-material/HistoryOutlined';
import InsightsOutlined from '@mui/icons-material/InsightsOutlined';
import ManageAccountsOutlined from '@mui/icons-material/ManageAccountsOutlined';
import { Box, Button, Chip, ListItemIcon, ListItemText, MenuItem } from '@mui/material';
import type { ReactNode } from 'react';
import { AppBar, Layout, Logout, Menu, TitlePortal, UserMenu, usePermissions } from 'react-admin';
import { Link as RouterLink } from 'react-router-dom';
import { brand, Logo } from '@cs/brand';

/** The contractor app. Set VITE_APP_URL for hosted deployments. */
const APP_URL = new URL(import.meta.env.VITE_APP_URL || 'http://localhost:5173').href;

function BackToAppButton() {
  return (
    <Button
      href={APP_URL}
      aria-label="Back to the ClientShield app"
      variant="outlined"
      startIcon={<ArrowBackOutlined />}
      sx={{
        color: brand.mist,
        borderColor: 'rgba(244, 247, 251, 0.5)',
        '&:hover': { borderColor: brand.mist },
        mr: 1,
        whiteSpace: 'nowrap',
        // On phones only the arrow shows; the label stays for screen readers.
        minWidth: 0,
        '& .MuiButton-startIcon': { mr: { xs: 0, sm: 1 }, ml: { xs: 0, sm: -0.5 } },
      }}
    >
      <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
        Back to app
      </Box>
    </Button>
  );
}

function AccountMenu() {
  return (
    <UserMenu>
      <MenuItem component="a" href={APP_URL}>
        <ListItemIcon>
          <ArrowBackOutlined fontSize="small" />
        </ListItemIcon>
        <ListItemText>Back to the app</ListItemText>
      </MenuItem>
      <Logout />
    </UserMenu>
  );
}

function BrandAppBar() {
  return (
    <AppBar color="secondary" userMenu={<AccountMenu />}>
      <Box
        component={RouterLink}
        to="/"
        aria-label="Admin dashboard"
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          mr: 2,
          color: 'inherit',
          textDecoration: 'none',
        }}
      >
        <Logo size={32} onDark />
        <Chip
          label="Admin"
          size="small"
          sx={{ bgcolor: brand.teal, color: brand.midnight, fontWeight: 700 }}
        />
      </Box>
      <TitlePortal />
      <BackToAppButton />
    </AppBar>
  );
}

function AdminMenu() {
  const { permissions } = usePermissions();
  return (
    <Menu>
      <Menu.DashboardItem />
      <Menu.Item to="/insights" primaryText="Insights" leftIcon={<InsightsOutlined />} />
      <Menu.ResourceItems />
      <Menu.Item to="/retention" primaryText="Retention" leftIcon={<HistoryOutlined />} />
      {permissions === 'admin' && (
        <Menu.Item to="/staff" primaryText="Staff" leftIcon={<ManageAccountsOutlined />} />
      )}
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
