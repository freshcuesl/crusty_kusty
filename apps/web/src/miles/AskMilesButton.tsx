import { Fab } from '@mui/material';
import { MilesAvatar } from '@cs/brand';
import { useMiles } from './useMiles';

/** The floating "Ask Miles" customer service button on every app page. */
export function AskMilesFab() {
  const { openMiles } = useMiles();
  return (
    <Fab
      variant="extended"
      color="primary"
      onClick={openMiles}
      sx={{
        position: 'fixed',
        right: 16,
        bottom: 'calc(16px + env(safe-area-inset-bottom))',
        gap: 1,
        textTransform: 'none',
        fontWeight: 700,
        pl: 0.75,
      }}
    >
      <MilesAvatar size={32} />
      Ask Miles
    </Fab>
  );
}
