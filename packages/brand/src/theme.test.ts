import { describe, expect, it } from 'vitest';
import { meetsWcagAA } from './contrast';
import { createAppTheme } from './theme';
import { brand } from './tokens';

describe('createAppTheme', () => {
  const light = createAppTheme('light');
  const dark = createAppTheme('dark');

  it('uses crust orange as the primary action color', () => {
    expect(light.palette.primary.main).toBe(brand.crust);
  });

  it('uses navy as the secondary (trust) color', () => {
    expect(light.palette.secondary.main).toBe(brand.navy);
  });

  it('uses cream as the light background', () => {
    expect(light.palette.background.default).toBe(brand.cream);
  });

  it('shows incident alerts in calm orange, not error red', () => {
    expect(light.palette.warning.main).toBe(brand.crust);
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

  it('switches to a dark background in dark mode', () => {
    expect(dark.palette.mode).toBe('dark');
    expect(dark.palette.background.default).toBe(brand.navyDeep);
  });

  it('makes touch targets at least 44px tall (mobile first)', () => {
    const button = light.components?.MuiButton?.styleOverrides?.root as { minHeight?: number };
    expect(button.minHeight).toBeGreaterThanOrEqual(44);
  });
});
