import AccountCircle from '@mui/icons-material/AccountCircle';
import AdminPanelSettingsOutlined from '@mui/icons-material/AdminPanelSettingsOutlined';
import CreditCardOutlined from '@mui/icons-material/CreditCardOutlined';
import GroupsOutlined from '@mui/icons-material/GroupsOutlined';
import LockOutlined from '@mui/icons-material/LockOutlined';
import VerifiedOutlined from '@mui/icons-material/VerifiedOutlined';
import Logout from '@mui/icons-material/Logout';
import { Divider, IconButton, ListItemIcon, Menu, MenuItem, Typography } from '@mui/material';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthProvider';

/** Where the admin panel lives. Set VITE_ADMIN_URL for hosted deployments. */
const ADMIN_URL = import.meta.env.VITE_ADMIN_URL || 'http://localhost:5174';

export function AccountMenu() {
  const { user, signOut, platformRole } = useAuth();
  const navigate = useNavigate();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const close = () => setAnchor(null);
  const go = (path: string) => {
    close();
    navigate(path);
  };

  return (
    <>
      <IconButton
        color="inherit"
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={anchor ? 'true' : undefined}
        onClick={(e) => setAnchor(e.currentTarget)}
      >
        <AccountCircle />
      </IconButton>
      <Menu anchorEl={anchor} open={anchor !== null} onClose={close}>
        {user?.email && (
          <Typography variant="body2" color="text.secondary" sx={{ px: 2, py: 1 }}>
            {user.email}
          </Typography>
        )}
        <Divider />
        {platformRole && (
          <MenuItem component="a" href={ADMIN_URL} onClick={close}>
            <ListItemIcon>
              <AdminPanelSettingsOutlined fontSize="small" />
            </ListItemIcon>
            Admin panel
          </MenuItem>
        )}
        <MenuItem onClick={() => go('/verification')}>
          <ListItemIcon>
            <VerifiedOutlined fontSize="small" />
          </ListItemIcon>
          Verification
        </MenuItem>
        <MenuItem onClick={() => go('/team')}>
          <ListItemIcon>
            <GroupsOutlined fontSize="small" />
          </ListItemIcon>
          Team
        </MenuItem>
        <MenuItem onClick={() => go('/billing')}>
          <ListItemIcon>
            <CreditCardOutlined fontSize="small" />
          </ListItemIcon>
          Plan and billing
        </MenuItem>
        <MenuItem onClick={() => go('/account/security')}>
          <ListItemIcon>
            <LockOutlined fontSize="small" />
          </ListItemIcon>
          Security
        </MenuItem>
        <MenuItem
          onClick={() => {
            close();
            void signOut();
          }}
        >
          <ListItemIcon>
            <Logout fontSize="small" />
          </ListItemIcon>
          Sign out
        </MenuItem>
      </Menu>
    </>
  );
}
