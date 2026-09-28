/**
 * Crusty Krustees brand palette: "Toasted trust".
 * Navy carries trust, crust orange carries the playful side.
 */
export const brand = {
  navy: '#16233B',
  navyDeep: '#0D1626',
  crust: '#E07A2F',
  crustDark: '#B3561A',
  cream: '#FBF5EA',
  white: '#FFFFFF',
  verified: '#2E9E6A',
  /** Darker green for "verified" text, which must stay readable on cream. */
  verifiedText: '#1D6B47',
  danger: '#B42318',
  slate: '#5B6474',
  mist: '#C9CFDA',
} as const;

export const fonts = {
  display: '"Fredoka", "Inter", system-ui, sans-serif',
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
  { name: 'body text on cream', foreground: brand.navy, background: brand.cream },
  { name: 'body text on white cards', foreground: brand.navy, background: brand.white },
  { name: 'secondary text on cream', foreground: brand.slate, background: brand.cream },
  { name: 'button text on crust', foreground: brand.navy, background: brand.crust },
  { name: 'cream text on navy header', foreground: brand.cream, background: brand.navy },
  { name: 'dark mode body text', foreground: brand.cream, background: brand.navyDeep },
  { name: 'dark mode secondary text', foreground: brand.mist, background: brand.navy },
  { name: 'verified label on cream', foreground: brand.verifiedText, background: brand.cream },
  { name: 'error text on cream', foreground: brand.danger, background: brand.cream },
  { name: 'crust accent on dark mode', foreground: brand.crust, background: brand.navyDeep },
];
