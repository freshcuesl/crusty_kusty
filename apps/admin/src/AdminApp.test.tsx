import { createFakeSupabase, type FakeState, typeText } from '@cs/core/testing';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { brand } from '@cs/brand';
import { AdminApp } from './AdminApp';
import { adminTheme } from './adminTheme';

const user = { id: 'm1', email: 'mod@clientshield.test' };
const verifiedFactor = [
  { id: 'f1', factor_type: 'totp' as const, status: 'verified' as const, friendly_name: 'Phone' },
];
const moderator: Partial<FakeState> = {
  session: { user },
  currentLevel: 'aal2',
  nextLevel: 'aal2',
  factors: verifiedFactor,
  rpc: { my_platform_role: 'moderator' },
};

function renderAdmin(state: Partial<FakeState>) {
  const fake = createFakeSupabase(state);
  render(<AdminApp supabase={fake.client} />);
  return fake;
}

describe('<AdminApp /> signed in', () => {
  it('opens on the moderation dashboard', async () => {
    renderAdmin(moderator);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Moderation' }),
    ).toBeInTheDocument();
  });

  it('brands the header as the ClientShield admin', async () => {
    renderAdmin(moderator);
    const header = await screen.findByRole('banner');
    expect(within(header).getByRole('img', { name: 'ClientShield' })).toBeInTheDocument();
    expect(within(header).getByText('Admin')).toBeInTheDocument();
  });

  it.each(['Business verifications', 'Incident review', 'Abuse flags'])(
    'shows the "%s" queue',
    async (queue) => {
      renderAdmin(moderator);
      expect(await screen.findByRole('heading', { name: queue })).toBeInTheDocument();
    },
  );
});

describe('<AdminApp /> login', () => {
  it('asks visitors to sign in', async () => {
    renderAdmin({});
    expect(await screen.findByRole('heading', { name: 'Admin sign in' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Moderation' })).not.toBeInTheDocument();
  });

  it('takes a moderator through password and code to the dashboard', async () => {
    const fake = renderAdmin({});
    fake.mocks.auth.signInWithPassword.mockImplementationOnce(async () => {
      Object.assign(fake.state, {
        session: { user },
        currentLevel: 'aal1',
        nextLevel: 'aal2',
        factors: verifiedFactor,
      });
      return { data: { user: null, session: null }, error: null } as never;
    });
    fake.mocks.auth.mfa.challengeAndVerify.mockImplementationOnce(async () => {
      Object.assign(fake.state, moderator);
      return { data: {}, error: null } as never;
    });

    await typeText(await screen.findByLabelText('Email'), 'mod@clientshield.test');
    await typeText(screen.getByLabelText('Password'), 'Shield-Strong-2026');
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));

    await typeText(await screen.findByLabelText('6-digit code'), '123456');
    await userEvent.click(screen.getByRole('button', { name: 'Verify' }));

    expect(fake.mocks.auth.mfa.challengeAndVerify).toHaveBeenCalledWith({
      factorId: 'f1',
      code: '123456',
    });
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Moderation' }),
    ).toBeInTheDocument();
  });

  it('sends accounts without two-step login to set it up in the main app first', async () => {
    const fake = renderAdmin({});
    fake.mocks.auth.signInWithPassword.mockImplementationOnce(async () => {
      Object.assign(fake.state, { session: { user }, currentLevel: 'aal1', nextLevel: 'aal1' });
      return { data: { user: null, session: null }, error: null } as never;
    });

    await typeText(await screen.findByLabelText('Email'), 'mod@clientshield.test');
    await typeText(screen.getByLabelText('Password'), 'Shield-Strong-2026');
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Set up two-step login in the ClientShield app first',
    );
    expect(fake.mocks.auth.signOut).toHaveBeenCalled();
  });

  it('refuses business accounts that are not moderators', async () => {
    const fake = renderAdmin({});
    fake.mocks.auth.signInWithPassword.mockImplementationOnce(async () => {
      Object.assign(fake.state, {
        session: { user },
        currentLevel: 'aal1',
        nextLevel: 'aal2',
        factors: verifiedFactor,
      });
      return { data: { user: null, session: null }, error: null } as never;
    });
    fake.mocks.auth.mfa.challengeAndVerify.mockImplementationOnce(async () => {
      Object.assign(fake.state, { ...moderator, rpc: {} });
      return { data: {}, error: null } as never;
    });

    await typeText(await screen.findByLabelText('Email'), 'owner@alpha.test');
    await typeText(screen.getByLabelText('Password'), 'Shield-Strong-2026');
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await typeText(await screen.findByLabelText('6-digit code'), '123456');
    await userEvent.click(screen.getByRole('button', { name: 'Verify' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "This account doesn't have admin access.",
    );
  });
});

describe('adminTheme', () => {
  it('shares the brand palette with the main app', () => {
    expect(adminTheme.palette?.primary).toMatchObject({ main: brand.teal });
    expect(adminTheme.palette?.secondary).toMatchObject({ main: brand.midnight });
  });
});

describe('<AdminApp /> login problems', () => {
  it('explains a wrong password', async () => {
    const fake = renderAdmin({});
    fake.mocks.auth.signInWithPassword.mockResolvedValueOnce({
      data: { user: null, session: null },
      error: { code: 'invalid_credentials', message: 'Invalid login credentials' },
    } as never);
    await typeText(await screen.findByLabelText('Email'), 'mod@clientshield.test');
    await typeText(screen.getByLabelText('Password'), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Email or password is incorrect.');
  });

  it('only accepts a 6-digit code', async () => {
    const fake = renderAdmin({});
    fake.mocks.auth.signInWithPassword.mockImplementationOnce(async () => {
      Object.assign(fake.state, {
        session: { user },
        currentLevel: 'aal1',
        nextLevel: 'aal2',
        factors: verifiedFactor,
      });
      return { data: { user: null, session: null }, error: null } as never;
    });
    await typeText(await screen.findByLabelText('Email'), 'mod@clientshield.test');
    await typeText(screen.getByLabelText('Password'), 'Shield-Strong-2026');
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await typeText(await screen.findByLabelText('6-digit code'), '12');
    await userEvent.click(screen.getByRole('button', { name: 'Verify' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Enter the 6-digit code');
    expect(fake.mocks.auth.mfa.challengeAndVerify).not.toHaveBeenCalled();
  });
});
