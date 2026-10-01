import { describe, expect, it } from 'vitest';
import { meetsWcagAA } from './contrast';
import { brand, contrastPairs } from './tokens';

describe('brand tokens', () => {
  it('uses the approved "Midnight and teal" palette', () => {
    expect(brand.midnight).toBe('#0B2545');
    expect(brand.teal).toBe('#2EC4B6');
    expect(brand.mist).toBe('#F4F7FB');
    expect(brand.amber).toBe('#F2A541');
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
