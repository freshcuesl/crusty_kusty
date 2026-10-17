import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach } from 'vitest';

// findBy*/waitFor default to 1s; react-admin and MUI pages under a full parallel run need more.
configure({ asyncUtilTimeout: 10_000 });

// jsdom has no matchMedia. Default to "no match"; tests that care spy on it.
if (typeof window !== 'undefined' && !window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string): MediaQueryList =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList,
  });
}

afterEach(() => {
  cleanup();
  // Every test starts like a fresh browser tab: no saved settings, no leftover address.
  if (typeof window !== 'undefined') {
    localStorage.clear();
    sessionStorage.clear();
    window.history.replaceState(null, '', '/');
  }
});
