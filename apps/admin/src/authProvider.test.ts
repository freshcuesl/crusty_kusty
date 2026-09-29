import { createFakeSupabase, type FakeState } from '@ck/core/testing';
import { describe, expect, it } from 'vitest';
import { createAuthProvider } from './authProvider';

const user = { id: 'm1', email: 'mod@krustees.test' };
const moderator: Partial<FakeState> = {
  session: { user },
  currentLevel: 'aal2',
  nextLevel: 'aal2',
  rpc: { my_platform_role: 'moderator' },
};

function setup(state: Partial<FakeState>) {
  const fake = createFakeSupabase(state);
  return { fake, auth: createAuthProvider(fake.client) };
}

describe('admin authProvider', () => {
  it('lets a moderator with two-step login in', async () => {
    const { auth } = setup(moderator);
    await expect(auth.checkAuth({})).resolves.toBeUndefined();
    await expect(auth.getPermissions!({})).resolves.toBe('moderator');
    await expect(auth.getIdentity!()).resolves.toEqual({ id: 'm1', fullName: 'mod@krustees.test' });
  });

  it('keeps out anyone without a session', async () => {
    const { auth } = setup({});
    await expect(auth.checkAuth({})).rejects.toBeDefined();
  });

  it('keeps out a moderator who has not entered their code', async () => {
    const { auth, fake } = setup({ ...moderator, currentLevel: 'aal1' });
    await expect(auth.checkAuth({})).rejects.toBeDefined();
    expect(fake.mocks.rpc).not.toHaveBeenCalled();
  });

  it('keeps out regular business accounts, even with two-step login', async () => {
    const { auth } = setup({ ...moderator, rpc: {} });
    await expect(auth.checkAuth({})).rejects.toBeDefined();
  });

  it('signs a regular account straight back out when it tries to log in here', async () => {
    const { auth, fake } = setup({ ...moderator, rpc: {} });
    await expect(auth.login({})).rejects.toThrow("This account doesn't have admin access.");
    expect(fake.mocks.auth.signOut).toHaveBeenCalled();
  });

  it('logs out through Supabase', async () => {
    const { auth, fake } = setup(moderator);
    await auth.logout({});
    expect(fake.mocks.auth.signOut).toHaveBeenCalled();
  });

  it.each([401, 403])('treats a %s from the API as signed out', async (status) => {
    const { auth } = setup(moderator);
    await expect(auth.checkError({ status })).rejects.toBeDefined();
  });

  it('ignores other API errors', async () => {
    const { auth } = setup(moderator);
    await expect(auth.checkError({ status: 500 })).resolves.toBeUndefined();
  });
});

describe('admin roles', () => {
  it('recognizes full admins as well as moderators', async () => {
    const { auth } = setup({ ...moderator, rpc: { my_platform_role: 'admin' } });
    await expect(auth.getPermissions!({})).resolves.toBe('admin');
  });

  it('reports no permissions and no identity when signed out', async () => {
    const { auth } = setup({});
    await expect(auth.getPermissions!({})).resolves.toBeNull();
    await expect(auth.getIdentity!()).rejects.toThrow('Sign in to continue.');
  });
});
