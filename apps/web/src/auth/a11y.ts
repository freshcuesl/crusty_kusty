/** Hides content visually while keeping it for screen readers. Sizes are explicit px:
 * MUI treats bare numbers <= 1 as percentages. */
export const visuallyHidden = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  margin: '-1px',
  padding: 0,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
  border: 0,
} as const;

export const isSixDigits = (code: string) => /^\d{6}$/.test(code);
