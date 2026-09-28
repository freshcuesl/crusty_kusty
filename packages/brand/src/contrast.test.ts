import { describe, expect, it } from 'vitest';
import { contrastRatio, meetsWcagAA, relativeLuminance } from './contrast';

describe('relativeLuminance', () => {
  it('is 0 for black and 1 for white', () => {
    expect(relativeLuminance('#000000')).toBe(0);
    expect(relativeLuminance('#ffffff')).toBe(1);
  });

  it('accepts 3-digit hex shorthand', () => {
    expect(relativeLuminance('#fff')).toBe(1);
  });

  it('rejects malformed colors', () => {
    expect(() => relativeLuminance('navy')).toThrow(/invalid hex color/i);
    expect(() => relativeLuminance('#12345')).toThrow(/invalid hex color/i);
  });
});

describe('contrastRatio', () => {
  it('is 21 for black on white', () => {
    expect(contrastRatio('#000', '#fff')).toBeCloseTo(21, 5);
  });

  it('is 1 for identical colors', () => {
    expect(contrastRatio('#E07A2F', '#E07A2F')).toBe(1);
  });

  it('is symmetric', () => {
    expect(contrastRatio('#16233B', '#FBF5EA')).toBe(contrastRatio('#FBF5EA', '#16233B'));
  });
});

describe('meetsWcagAA', () => {
  it('requires 4.5:1 for normal text', () => {
    expect(meetsWcagAA('#767676', '#ffffff')).toBe(true); // 4.54:1
    expect(meetsWcagAA('#777777', '#ffffff')).toBe(false); // 4.48:1
  });

  it('requires only 3:1 for large text', () => {
    expect(meetsWcagAA('#949494', '#ffffff', { largeText: true })).toBe(true);
    expect(meetsWcagAA('#949494', '#ffffff')).toBe(false);
  });
});
