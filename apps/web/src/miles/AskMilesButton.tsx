import { Button, Fab } from '@mui/material';
import { MilesAvatar } from '@cs/brand';
import type { MilesJob } from './jobs';
import { useMiles } from './useMiles';

/** The floating "Ask Miles" button on every app page. */
export function AskMilesFab() {
  const { openMiles } = useMiles();
  return (
    <Fab
      variant="extended"
      color="primary"
      onClick={() => openMiles({ mode: 'help' })}
      sx={{
        position: 'fixed',
        right: 16,
        bottom: 'calc(16px + env(safe-area-inset-bottom))',
        gap: 1,
        textTransform: 'none',
        fontWeight: 700,
        pl: 1,
      }}
    >
      <MilesAvatar size={28} />
      Ask Miles
    </Fab>
  );
}

/** A button that opens Miles for a specific job, e.g. on an incident or alert page. */
export function AskMilesButton({ job, label }: { job: MilesJob; label: string }) {
  const { openMiles } = useMiles();
  return (
    <Button
      variant="outlined"
      onClick={() => openMiles(job)}
      startIcon={<MilesAvatar size={22} />}
      sx={{ alignSelf: 'flex-start' }}
    >
      {label}
    </Button>
  );
}
