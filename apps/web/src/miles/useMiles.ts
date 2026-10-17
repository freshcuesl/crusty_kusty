import { createContext, useContext } from 'react';
import type { MilesJob } from './jobs';

export const MilesContext = createContext<{ openMiles(job: MilesJob): void } | null>(null);

/** Opens Miles for a job. Outside the app frame (tests, sign-in pages) it does nothing. */
export function useMiles() {
  return useContext(MilesContext) ?? { openMiles: () => {} };
}
