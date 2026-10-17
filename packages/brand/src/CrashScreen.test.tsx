import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CrashScreen } from './CrashScreen';

describe('CrashScreen', () => {
  it('explains what happened and offers a reload', async () => {
    const reload = vi.fn();
    vi.stubGlobal('location', { ...window.location, reload });
    render(<CrashScreen />);
    expect(screen.getByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Reload' }));
    expect(reload).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
