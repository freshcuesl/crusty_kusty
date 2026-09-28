/**
 * WCAG 2.x contrast helpers. Tests use these to guarantee every color pairing
 * in the brand stays readable.
 */

const HEX_PATTERN = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

function parseHex(hex: string): [number, number, number] {
  if (!HEX_PATTERN.test(hex)) {
    throw new Error(`Invalid hex color: ${hex}`);
  }
  let digits = hex.slice(1);
  if (digits.length === 3) {
    digits = [...digits].map((d) => d + d).join('');
  }
  return [0, 2, 4].map((i) => parseInt(digits.slice(i, i + 2), 16)) as [number, number, number];
}

function channelToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = parseHex(hex).map(channelToLinear) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x) as [
    number,
    number,
  ];
  return (light + 0.05) / (dark + 0.05);
}

export interface ContrastOptions {
  /** Large text is at least 18pt, or 14pt bold. */
  largeText?: boolean | undefined;
}

export function meetsWcagAA(
  foreground: string,
  background: string,
  options: ContrastOptions = {},
): boolean {
  const minimum = options.largeText ? 3 : 4.5;
  return contrastRatio(foreground, background) >= minimum;
}
