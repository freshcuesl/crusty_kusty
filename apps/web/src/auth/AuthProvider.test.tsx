import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { createFakeSupabase, type FakeSupabase } from '@cs/core/testing';
import { AuthProvider, useAuth } from './AuthProvider';
import { SupabaseProvider } from './SupabaseProvider';

const user = { id: 'u1', email: 'owner@alpha.test' };
const membership = {
  role: 'owner' as const,
  business: { id: 'b1', name: 'Alpha Plumbing', verification_status: 'unverified' },
};

function setup(fake: FakeSupabase) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <SupabaseProvider client={fake.client}>
      <AuthProvider>{children}</AuthProvider>
    </SupabaseProvider>
  );
  return renderHook(() => useAuth(), { wrapper });
}

describe('<AuthProvider />', () => {
  it('starts loading, then reports signed-out without a session', async () => {
    const { result } = setup(createFakeSupabase());
    expect(result.current.step).toBe('loading');
    await waitFor(() => expect(result.current.step).toBe('signed-out'));
  });

  it('lets a fully set-up user in, with their business', async () => {
    const fake = createFakeSupabase({
      session: { user },
      currentLevel: 'aal2',
      nextLevel: 'aal2',
      membership,
    });
    const { result } = setup(fake);

    await waitFor(() => expect(result.current.step).toBe('ready'));
    expect(result.current.user?.email).toBe('owner@alpha.test');
    expect(result.current.membership).toEqual({
      role: 'owner',
      businessId: 'b1',
      businessName: 'Alpha Plumbing',
      verificationStatus: 'unverified',
    });
    expect(fake.mocks.from).toHaveBeenCalledWith('business_members');
    expect(fake.query.eq).toHaveBeenCalledWith('user_id', 'u1');
  });

  it('asks for the code before loading any business data', async () => {
    const fake = createFakeSupabase({
      session: { user },
      currentLevel: 'aal1',
      nextLevel: 'aal2',
    });
    const { result } = setup(fake);

    await waitFor(() => expect(result.current.step).toBe('mfa-verify'));
    expect(fake.mocks.from).not.toHaveBeenCalled();
  });

  it('follows sign-in events from Supabase', async () => {
    const fake = createFakeSupabase();
    const { result } = setup(fake);
    await waitFor(() => expect(result.current.step).toBe('signed-out'));

    Object.assign(fake.state, { session: { user }, currentLevel: 'aal1', nextLevel: 'aal1' });
    act(() => fake.emit('SIGNED_IN'));

    await waitFor(() => expect(result.current.step).toBe('mfa-setup'));
  });

  it('refresh() picks up a newly created business', async () => {
    const fake = createFakeSupabase({ session: { user }, currentLevel: 'aal2', nextLevel: 'aal2' });
    const { result } = setup(fake);
    await waitFor(() => expect(result.current.step).toBe('onboarding'));

    fake.state.membership = membership;
    await act(() => result.current.refresh());

    expect(result.current.step).toBe('ready');
  });

  it('signOut() returns to signed-out', async () => {
    const fake = createFakeSupabase({
      session: { user },
      currentLevel: 'aal2',
      nextLevel: 'aal2',
      membership,
    });
    const { result } = setup(fake);
    await waitFor(() => expect(result.current.step).toBe('ready'));

    await act(() => result.current.signOut());

    await waitFor(() => expect(result.current.step).toBe('signed-out'));
  });

  it('treats a failed session lookup as signed out rather than hanging', async () => {
    const fake = createFakeSupabase();
    fake.mocks.auth.getSession.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const { result } = setup(fake);
    await waitFor(() => expect(result.current.step).toBe('signed-out'));
  });

  it('refuses to be used outside the provider', () => {
    expect(() => renderHook(() => useAuth())).toThrow(/AuthProvider/);
  });
});
