import CheckOutlined from '@mui/icons-material/CheckOutlined';
import {
  Chip,
  List,
  ListItem,
  Paper,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { useId, type ReactNode } from 'react';
import type { PlanInfo } from './plans';
import type { Interval } from './subscription';

export function IntervalToggle({
  value,
  onChange,
}: {
  value: Interval;
  onChange: (value: Interval) => void;
}) {
  return (
    <ToggleButtonGroup
      exclusive
      size="small"
      value={value}
      onChange={(_, next: Interval | null) => next && onChange(next)}
      aria-label="Billing period"
      // MUI's default grey is just under 4.5:1 on the mist background; use body text.
      sx={{ '& .MuiToggleButton-root': { color: 'text.primary', px: 2 } }}
    >
      <ToggleButton value="month">Monthly</ToggleButton>
      <ToggleButton value="year">Yearly</ToggleButton>
    </ToggleButtonGroup>
  );
}

interface PlanCardProps {
  plan: PlanInfo;
  interval: Interval;
  /** A chip in the corner, e.g. "Current" or "Most popular". */
  badge?: string | undefined;
  highlight?: boolean;
  action?: ReactNode;
}

export function PlanCard({ plan, interval, badge, highlight = false, action }: PlanCardProps) {
  const nameId = useId();
  const price = plan.price;
  return (
    <ListItem aria-labelledby={nameId} disablePadding sx={{ display: 'block', height: '100%' }}>
      <Paper
        variant="outlined"
        sx={{
          p: 2.5,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
          borderRadius: 3,
          borderColor: highlight ? 'primary.main' : undefined,
          borderWidth: highlight ? 2 : 1,
        }}
      >
        <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography id={nameId} variant="h6" component="h3">
            {plan.name}
          </Typography>
          {badge && <Chip size="small" color="primary" label={badge} />}
        </Stack>
        <Typography variant="body2" color="text.secondary">
          {plan.tagline}
        </Typography>
        <Typography variant="h4" component="p" sx={{ fontWeight: 700 }}>
          {price ? `$${price[interval]}` : 'Contact us'}
          {price && price.month > 0 && (
            <Typography component="span" color="text.secondary">
              {' '}
              / {interval}
            </Typography>
          )}
        </Typography>
        {price && price.month > 0 && interval === 'year' && (
          <Typography variant="body2" color="success.main" sx={{ fontWeight: 600 }}>
            2 months free
          </Typography>
        )}
        <Stack component="ul" spacing={0.75} sx={{ listStyle: 'none', p: 0, m: 0, flex: 1 }}>
          {plan.features.map((feature) => (
            <Stack component="li" key={feature} direction="row" spacing={1}>
              <CheckOutlined fontSize="small" color="primary" aria-hidden="true" />
              <Typography variant="body2">{feature}</Typography>
            </Stack>
          ))}
        </Stack>
        {action}
      </Paper>
    </ListItem>
  );
}

export function PlanGrid({ children }: { children: ReactNode }) {
  return (
    <List
      aria-label="Plans"
      disablePadding
      sx={{
        display: 'grid',
        gap: 2,
        gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(4, 1fr)' },
      }}
    >
      {children}
    </List>
  );
}
