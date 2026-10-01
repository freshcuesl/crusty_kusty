import { describe, expect, it } from 'vitest';
import { meetsWcagAA } from './contrast';
import { accentTextColor, createAppTheme } from './theme';
import { brand } from './tokens';

describe('createAppTheme', () => {
  const light = createAppTheme('light');
  const dark = createAppTheme('dark');

  it('uses teal as the primary action color', () => {
    expect(light.palette.primary.main).toBe(brand.teal);
  });

  it('uses midnight as the secondary (trust) color', () => {
    expect(light.palette.secondary.main).toBe(brand.midnight);
  });

  it('uses mist as the light background', () => {
    expect(light.palette.background.default).toBe(brand.mist);
  });

  it('shows incident alerts in calm amber, not error red', () => {
    expect(light.palette.warning.main).toBe(brand.amber);
    expect(light.palette.warning.main).not.toBe(light.palette.error.main);
  });

  it.each([
    ['light', light],
    ['dark', dark],
  ] as const)('%s theme: button text is readable on primary', (_mode, theme) => {
    expect(meetsWcagAA(theme.palette.primary.contrastText, theme.palette.primary.main)).toBe(true);
  });

  it.each([
    ['light', light],
    ['dark', dark],
  ] as const)('%s theme: body text is readable on the page background', (_mode, theme) => {
    expect(meetsWcagAA(theme.palette.text.primary, theme.palette.background.default)).toBe(true);
    expect(meetsWcagAA(theme.palette.text.primary, theme.palette.background.paper)).toBe(true);
  });

  it.each([
    ['light', light],
    ['dark', dark],
  ] as const)('%s theme: teal text is readable on the page and on cards', (mode, theme) => {
    const accent = accentTextColor(mode);
    expect(meetsWcagAA(accent, theme.palette.background.default)).toBe(true);
    expect(meetsWcagAA(accent, theme.palette.background.paper)).toBe(true);
  });

  it.each([
    ['light', light],
    ['dark', dark],
  ] as const)('%s theme: links and text/outlined buttons use the readable teal', (mode, theme) => {
    const accent = accentTextColor(mode);
    expect(theme.components?.MuiLink?.defaultProps?.color).toBe(accent);
    const variants = (theme.components?.MuiButton?.variants ?? []) as {
      props: { variant?: string; color?: string };
      style: { color?: string };
    }[];
    for (const variant of ['text', 'outlined']) {
      const rule = variants.find((v) => v.props.variant === variant && v.props.color === 'primary');
      expect(rule?.style.color).toBe(accent);
    }
  });

  it('switches to a dark background in dark mode', () => {
    expect(dark.palette.mode).toBe('dark');
    expect(dark.palette.background.default).toBe(brand.midnightDeep);
  });

  it('makes touch targets at least 44px tall (mobile first)', () => {
    const button = light.components?.MuiButton?.styleOverrides?.root as { minHeight?: number };
    expect(button.minHeight).toBeGreaterThanOrEqual(44);
  });
});
