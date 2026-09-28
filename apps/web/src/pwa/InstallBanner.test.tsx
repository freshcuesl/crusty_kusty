import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InstallBanner } from './InstallBanner';
import type { InstallPromptState } from './useInstallPrompt';

const state: InstallPromptState = {
  canInstall: false,
  isInstalled: false,
  platform: 'prompt',
  promptInstall: vi.fn().mockResolvedValue('accepted'),
};

vi.mock('./useInstallPrompt', () => ({
  useInstallPrompt: () => state,
}));

beforeEach(() => {
  Object.assign(state, {
    canInstall: false,
    isInstalled: false,
    platform: 'prompt',
    promptInstall: vi.fn().mockResolvedValue('accepted'),
  });
  localStorage.clear();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('<InstallBanner />', () => {
  it('stays hidden when the browser cannot install yet', () => {
    render(<InstallBanner />);
    expect(screen.queryByRole('region', { name: /install/i })).not.toBeInTheDocument();
  });

  it('offers a one-tap install on Android and desktop', async () => {
    state.canInstall = true;
    render(<InstallBanner />);

    await userEvent.click(screen.getByRole('button', { name: 'Install app' }));

    expect(state.promptInstall).toHaveBeenCalledOnce();
  });

  it('explains the Share → Add to Home Screen steps on iPhone', () => {
    state.platform = 'ios';
    render(<InstallBanner />);
    expect(screen.getByRole('region', { name: /install/i })).toHaveTextContent(
      /Share.*Add to Home Screen/,
    );
    expect(screen.queryByRole('button', { name: 'Install app' })).not.toBeInTheDocument();
  });

  it('never shows once the app is installed', () => {
    state.canInstall = true;
    state.isInstalled = true;
    render(<InstallBanner />);
    expect(screen.queryByRole('region', { name: /install/i })).not.toBeInTheDocument();
  });

  it('can be dismissed, and remembers that choice', async () => {
    state.canInstall = true;
    const { unmount } = render(<InstallBanner />);

    await userEvent.click(screen.getByRole('button', { name: 'Not now' }));
    expect(screen.queryByRole('region', { name: /install/i })).not.toBeInTheDocument();

    unmount();
    render(<InstallBanner />);
    expect(screen.queryByRole('region', { name: /install/i })).not.toBeInTheDocument();
  });

  it('still works when storage is blocked (private browsing)', async () => {
    state.canInstall = true;
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    render(<InstallBanner />);
    await userEvent.click(screen.getByRole('button', { name: 'Not now' }));

    expect(screen.queryByRole('region', { name: /install/i })).not.toBeInTheDocument();
  });
});
