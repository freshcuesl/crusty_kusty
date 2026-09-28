import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UpdatePrompt } from './UpdatePrompt';

const sw = {
  needRefresh: false,
  setNeedRefresh: vi.fn(),
  updateServiceWorker: vi.fn(),
};

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [sw.needRefresh, sw.setNeedRefresh],
    offlineReady: [false, vi.fn()],
    updateServiceWorker: sw.updateServiceWorker,
  }),
}));

beforeEach(() => {
  sw.needRefresh = false;
  sw.setNeedRefresh.mockClear();
  sw.updateServiceWorker.mockClear();
});

describe('<UpdatePrompt />', () => {
  it('shows nothing while the app is up to date', () => {
    render(<UpdatePrompt />);
    expect(screen.queryByText(/new version/i)).not.toBeInTheDocument();
  });

  it('tells the user a new version is ready', () => {
    sw.needRefresh = true;
    render(<UpdatePrompt />);
    expect(screen.getByRole('status')).toHaveTextContent(/new version/i);
  });

  it('reloads into the new version on request', async () => {
    sw.needRefresh = true;
    render(<UpdatePrompt />);
    await userEvent.click(screen.getByRole('button', { name: 'Update now' }));
    expect(sw.updateServiceWorker).toHaveBeenCalledWith(true);
  });

  it('can be postponed', async () => {
    sw.needRefresh = true;
    render(<UpdatePrompt />);
    await userEvent.click(screen.getByRole('button', { name: 'Later' }));
    expect(sw.setNeedRefresh).toHaveBeenCalledWith(false);
  });
});
