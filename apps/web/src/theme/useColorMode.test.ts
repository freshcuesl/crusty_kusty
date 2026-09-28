import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useColorMode } from './useColorMode';

function mockPrefersDark(initial: boolean) {
  let listener: ((e: { matches: boolean }) => void) | undefined;
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query: string) =>
      ({
        matches: query === '(prefers-color-scheme: dark)' ? initial : false,
        media: query,
        addEventListener: (_: string, cb: (e: { matches: boolean }) => void) => {
          listener = cb;
        },
        removeEventListener: vi.fn(),
      }) as unknown as MediaQueryList,
  );
  return (matches: boolean) => act(() => listener?.({ matches }));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useColorMode', () => {
  it('uses light mode when the phone is in light mode', () => {
    mockPrefersDark(false);
    const { result } = renderHook(() => useColorMode());
    expect(result.current).toBe('light');
  });

  it('uses dark mode when the phone is in dark mode', () => {
    mockPrefersDark(true);
    const { result } = renderHook(() => useColorMode());
    expect(result.current).toBe('dark');
  });

  it('follows the phone when it switches at night', () => {
    const switchTo = mockPrefersDark(false);
    const { result } = renderHook(() => useColorMode());
    switchTo(true);
    expect(result.current).toBe('dark');
  });
});
