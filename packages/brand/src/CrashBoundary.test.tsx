import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CrashBoundary } from './CrashBoundary';

function Broken(): never {
  throw new Error('boom');
}

describe('CrashBoundary', () => {
  it('shows the fallback and reports the error', () => {
    const onError = vi.fn();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <CrashBoundary fallback={<p>Something went wrong</p>} onError={onError}>
        <Broken />
      </CrashBoundary>,
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'boom' }),
      expect.anything(),
    );
    vi.restoreAllMocks();
  });

  it('shows the page when nothing is wrong', () => {
    render(
      <CrashBoundary fallback={<p>Something went wrong</p>}>
        <p>All good</p>
      </CrashBoundary>,
    );
    expect(screen.getByText('All good')).toBeInTheDocument();
  });
});
