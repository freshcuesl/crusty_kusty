import CheckCircle from '@mui/icons-material/CheckCircle';
import RadioButtonUnchecked from '@mui/icons-material/RadioButtonUnchecked';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import {
  Alert,
  Box,
  CircularProgress,
  Container,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useId, useState, type ReactNode } from 'react';
import { Outlet } from 'react-router';
import { Logo } from '@cs/brand';
import { visuallyHidden } from './a11y';
import { passwordRules } from './passwordPolicy';

/** Centered card layout for sign-in, sign-up and setup screens. */
export function AuthLayout() {
  return (
    <Box
      component="main"
      id="main"
      sx={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: { xs: 'stretch', sm: 'center' },
        py: { xs: 3, sm: 6 },
        pt: 'calc(24px + env(safe-area-inset-top))',
      }}
    >
      <Container maxWidth="xs">
        <Stack spacing={3} sx={{ alignItems: 'center' }}>
          <Logo size={56} withWordmark />
          <Paper variant="outlined" sx={{ p: { xs: 2.5, sm: 4 }, width: '100%', borderRadius: 4 }}>
            <Outlet />
          </Paper>
        </Stack>
      </Container>
    </Box>
  );
}

export function PageTitle({ children, subtitle }: { children: ReactNode; subtitle?: ReactNode }) {
  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="h5" component="h1">
        {children}
      </Typography>
      {subtitle && (
        <Typography color="text.secondary" sx={{ mt: 1 }}>
          {subtitle}
        </Typography>
      )}
    </Box>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return <Alert severity="error">{message}</Alert>;
}

export function FullPageSpinner() {
  return (
    <Box sx={{ minHeight: '60dvh', display: 'grid', placeItems: 'center' }}>
      <CircularProgress aria-label="Loading" />
    </Box>
  );
}

interface PasswordFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: 'current-password' | 'new-password';
  showRules?: boolean;
}

export function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
  showRules = false,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const rulesId = useId();

  return (
    <Stack spacing={1}>
      <TextField
        label={label}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        fullWidth
        slotProps={{
          htmlInput: showRules ? { 'aria-describedby': rulesId } : {},
          input: {
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  aria-label={visible ? 'Hide password' : 'Show password'}
                  onClick={() => setVisible((v) => !v)}
                  edge="end"
                >
                  {visible ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              </InputAdornment>
            ),
          },
        }}
      />
      {showRules && (
        <Box
          component="ul"
          id={rulesId}
          aria-label="Password rules"
          sx={{ listStyle: 'none', p: 0, m: 0, display: 'grid', gap: 0.5 }}
        >
          {passwordRules.map((rule) => {
            const met = rule.test(value);
            return (
              <Box
                component="li"
                key={rule.label}
                data-met={String(met)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  fontSize: 14,
                  color: met ? 'success.dark' : 'text.secondary',
                }}
              >
                {met ? (
                  <CheckCircle fontSize="small" aria-hidden="true" />
                ) : (
                  <RadioButtonUnchecked fontSize="small" aria-hidden="true" />
                )}
                <span>{rule.label}</span>
                <Box component="span" sx={visuallyHidden}>
                  {met ? '(done)' : '(missing)'}
                </Box>
              </Box>
            );
          })}
        </Box>
      )}
    </Stack>
  );
}

export function CodeField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <TextField
      label="6-digit code"
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\s/g, ''))}
      autoComplete="one-time-code"
      fullWidth
      slotProps={{
        htmlInput: {
          inputMode: 'numeric',
          maxLength: 6,
          style: { fontSize: 24, letterSpacing: 8, textAlign: 'center' },
        },
      }}
    />
  );
}
