import { useEffect, useState } from 'react';
import type { ColorMode } from '@cs/brand';

const QUERY = '(prefers-color-scheme: dark)';

/** Follows the device's light/dark setting, including changes while the app is open. */
export function useColorMode(): ColorMode {
  const [mode, setMode] = useState<ColorMode>(() =>
    window.matchMedia(QUERY).matches ? 'dark' : 'light',
  );

  useEffect(() => {
    const media = window.matchMedia(QUERY);
    const onChange = (event: { matches: boolean }) => setMode(event.matches ? 'dark' : 'light');
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  return mode;
}
