/**
 * ClientShield brand palette: "Midnight and teal".
 * Midnight carries trust, teal marks actions and verified facts, amber marks alerts.
 */
export const brand = {
  midnight: '#0B2545',
  midnightDeep: '#071A33',
  midnightSoft: '#13315C',
  teal: '#2EC4B6',
  /** Darker teal for text and links, which must stay readable on mist and white. */
  tealDark: '#0E7C72',
  mist: '#F4F7FB',
  white: '#FFFFFF',
  amber: '#F2A541',
  danger: '#B42318',
  slate: '#4A5568',
  /** Secondary text in dark mode. */
  haze: '#C5D0E0',
} as const;

export const fonts = {
  display: '"Plus Jakarta Sans", "Inter", system-ui, sans-serif',
  body: '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
} as const;

export interface ContrastPair {
  name: string;
  foreground: string;
  background: string;
  largeText?: boolean;
}

/** Every text/background pairing the UI uses. Tests hold each one to WCAG AA. */
export const contrastPairs: ContrastPair[] = [
  { name: 'body text on mist', foreground: brand.midnight, background: brand.mist },
  { name: 'body text on white cards', foreground: brand.midnight, background: brand.white },
  { name: 'secondary text on mist', foreground: brand.slate, background: brand.mist },
  { name: 'secondary text on white cards', foreground: brand.slate, background: brand.white },
  { name: 'button text on teal', foreground: brand.midnight, background: brand.teal },
  { name: 'header text on midnight', foreground: brand.mist, background: brand.midnight },
  { name: 'dark mode body text', foreground: brand.mist, background: brand.midnightDeep },
  { name: 'dark mode secondary text', foreground: brand.haze, background: brand.midnightSoft },
  { name: 'links and verified labels on mist', foreground: brand.tealDark, background: brand.mist },
  { name: 'links on white cards', foreground: brand.tealDark, background: brand.white },
  { name: 'error text on mist', foreground: brand.danger, background: brand.mist },
  { name: 'teal accent in dark mode', foreground: brand.teal, background: brand.midnightDeep },
  { name: 'teal accent on dark cards', foreground: brand.teal, background: brand.midnightSoft },
  { name: 'alert text on amber', foreground: brand.midnight, background: brand.amber },
  {
    name: 'logo accent on mist',
    foreground: brand.tealDark,
    background: brand.mist,
    largeText: true,
  },
  {
    name: 'logo accent on midnight header',
    foreground: brand.teal,
    background: brand.midnight,
    largeText: true,
  },
];
