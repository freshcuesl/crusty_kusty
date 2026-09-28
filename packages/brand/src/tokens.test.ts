import { describe, expect, it } from 'vitest';
import { meetsWcagAA } from './contrast';
import { brand, contrastPairs } from './tokens';

describe('brand tokens', () => {
  it('uses the approved "Toasted trust" palette', () => {
    expect(brand.navy).toBe('#16233B');
    expect(brand.crust).toBe('#E07A2F');
    expect(brand.cream).toBe('#FBF5EA');
    expect(brand.verified).toBe('#2E9E6A');
  });

  it('declares the text/background pairs the UI relies on', () => {
    expect(contrastPairs.length).toBeGreaterThan(0);
  });

  it.each(contrastPairs)(
    '$name meets WCAG AA contrast',
    ({ foreground, background, largeText }) => {
      expect(meetsWcagAA(foreground, background, { largeText })).toBe(true);
    },
  );
});
