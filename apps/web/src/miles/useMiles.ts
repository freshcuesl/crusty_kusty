import { createContext, useContext } from 'react';

export const MilesContext = createContext<{ openMiles(): void } | null>(null);

/** Opens the Miles chat. Outside the app frame (tests, sign-in pages) it does nothing. */
export function useMiles() {
  return useContext(MilesContext) ?? { openMiles: () => {} };
}
