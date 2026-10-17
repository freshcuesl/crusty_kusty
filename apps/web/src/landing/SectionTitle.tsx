import { Box, Typography } from '@mui/material';
import type { ReactNode } from 'react';

export function SectionTitle({ eyebrow, children }: { eyebrow: string; children: ReactNode }) {
  return (
    <Box sx={{ mb: { xs: 4, md: 6 }, maxWidth: 640 }}>
      <Typography
        variant="overline"
        sx={{
          // Dark teal reads on light backgrounds; bright teal on dark ones.
          color: (t) => (t.palette.mode === 'dark' ? 'primary.main' : 'primary.dark'),
          fontWeight: 700,
          letterSpacing: '0.12em',
        }}
      >
        {eyebrow}
      </Typography>
      <Typography
        variant="h2"
        component="h2"
        sx={{ fontSize: { xs: 32, md: 42 }, letterSpacing: '-0.02em', mt: 0.5 }}
      >
        {children}
      </Typography>
    </Box>
  );
}
