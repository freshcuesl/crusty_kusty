import { ThemeProvider } from '@mui/material';
import { render } from '@testing-library/react';
import { useEffect } from 'react';
import { MemoryRouter, useLocation } from 'react-router';
import { createAppTheme } from '@cs/brand';
import { AppRoutes } from '../App';
import { AuthProvider } from '../auth/AuthProvider';
import { SupabaseProvider } from '../auth/SupabaseProvider';
import { createFakeSupabase, type FakeState } from '@cs/core/testing';

export const testUser = { id: 'u1', email: 'owner@alpha.test' };

export const ownerMembership: NonNullable<FakeState['membership']> = {
  role: 'owner',
  business: { id: 'b1', name: 'Alpha Plumbing', verification_status: 'unverified' },
};

/** Ready-made auth states for tests. */
export const as = {
  signedOut: {} as Partial<FakeState>,
  needsMfaSetup: {
    session: { user: testUser },
    currentLevel: 'aal1',
    nextLevel: 'aal1',
  } as Partial<FakeState>,
  needsMfaCode: {
    session: { user: testUser },
    currentLevel: 'aal1',
    nextLevel: 'aal2',
    factors: [{ id: 'f1', factor_type: 'totp', status: 'verified', friendly_name: 'Phone' }],
  } as Partial<FakeState>,
  needsBusiness: {
    session: { user: testUser },
    currentLevel: 'aal2',
    nextLevel: 'aal2',
    factors: [{ id: 'f1', factor_type: 'totp', status: 'verified', friendly_name: 'Phone' }],
  } as Partial<FakeState>,
  owner: {
    session: { user: testUser },
    currentLevel: 'aal2',
    nextLevel: 'aal2',
    factors: [{ id: 'f1', factor_type: 'totp', status: 'verified', friendly_name: 'Phone' }],
    membership: ownerMembership,
  } as Partial<FakeState>,
  verifiedOwner: {
    session: { user: testUser },
    currentLevel: 'aal2',
    nextLevel: 'aal2',
    factors: [{ id: 'f1', factor_type: 'totp', status: 'verified', friendly_name: 'Phone' }],
    membership: {
      ...ownerMembership,
      business: { ...ownerMembership.business, verification_status: 'verified' },
    },
  } as Partial<FakeState>,
};

const spy = { path: '/' };
function LocationSpy() {
  const { pathname } = useLocation();
  useEffect(() => {
    spy.path = pathname;
  }, [pathname]);
  return null;
}

/** Renders the whole app at a route, with a fake Supabase in the given state. */
export function renderApp(route: string, state: Partial<FakeState> = {}) {
  const fake = createFakeSupabase(state);
  const result = render(
    <SupabaseProvider client={fake.client}>
      <AuthProvider>
        <ThemeProvider theme={createAppTheme('light')}>
          <MemoryRouter initialEntries={[route]}>
            <AppRoutes />
            <LocationSpy />
          </MemoryRouter>
        </ThemeProvider>
      </AuthProvider>
    </SupabaseProvider>,
  );
  return { ...result, fake, path: () => spy.path };
}
