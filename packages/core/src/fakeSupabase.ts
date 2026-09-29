import type { SupabaseClient } from '@supabase/supabase-js';
import { vi } from 'vitest';

type Level = 'aal1' | 'aal2' | null;

export interface FakeState {
  session: { user: { id: string; email: string } } | null;
  currentLevel: Level;
  nextLevel: Level;
  membership: {
    role: 'owner' | 'staff';
    business: { id: string; name: string; verification_status: string };
  } | null;
  factors: {
    id: string;
    friendly_name?: string;
    factor_type: 'totp';
    status: 'verified' | 'unverified';
    created_at?: string;
  }[];
  /** Rows returned by list queries, keyed by table name. */
  tables: Record<string, unknown[]>;
  /** Results returned by supabase.rpc(name), keyed by function name. */
  rpc: Record<string, unknown>;
}

const ok = <T>(data: T) => Promise.resolve({ data, error: null });

/**
 * A stand-in Supabase client for component tests. Each method is a vi.fn so
 * tests can assert calls or override results with mockResolvedValueOnce.
 */
export function createFakeSupabase(initial: Partial<FakeState> = {}) {
  const state: FakeState = {
    session: null,
    currentLevel: null,
    nextLevel: null,
    membership: null,
    factors: [],
    tables: {},
    rpc: {},
    ...initial,
  };
  const listeners = new Set<(event: string, session: unknown) => void>();

  const emit = (event: string) => {
    listeners.forEach((listener) => listener(event, state.session));
  };

  let lastTable = '';
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    is: vi.fn(() => query),
    order: vi.fn(() => query),
    delete: vi.fn(() => query),
    maybeSingle: vi.fn(() => ok(state.membership)),
    // List queries are awaited directly, like the real query builder.
    then: (resolve: (value: { data: unknown[]; error: null }) => unknown) =>
      resolve({ data: state.tables[lastTable] ?? [], error: null }),
  };

  const auth = {
    getSession: vi.fn(() => ok({ session: state.session })),
    onAuthStateChange: vi.fn((callback: (event: string, session: unknown) => void) => {
      listeners.add(callback);
      return { data: { subscription: { unsubscribe: () => listeners.delete(callback) } } };
    }),
    signInWithPassword: vi.fn(() => ok({ user: null, session: null })),
    signUp: vi.fn(() => ok({ user: null, session: null })),
    signOut: vi.fn(() => {
      state.session = null;
      emit('SIGNED_OUT');
      return Promise.resolve({ error: null });
    }),
    resetPasswordForEmail: vi.fn(() => ok({})),
    updateUser: vi.fn(() => ok({ user: null })),
    mfa: {
      getAuthenticatorAssuranceLevel: vi.fn(() =>
        ok({
          currentLevel: state.currentLevel,
          nextLevel: state.nextLevel,
          currentAuthenticationMethods: [],
        }),
      ),
      listFactors: vi.fn(() =>
        ok({
          all: state.factors,
          totp: state.factors.filter((f) => f.status === 'verified'),
          phone: [],
        }),
      ),
      enroll: vi.fn(() =>
        ok({
          id: 'factor-new',
          type: 'totp',
          friendly_name: 'Authenticator app',
          totp: {
            qr_code: 'data:image/svg+xml;utf-8,<svg xmlns="http://www.w3.org/2000/svg"/>',
            secret: 'JBSWY3DPEHPK3PXP',
            uri: 'otpauth://totp/Crusty%20Krustees:owner@alpha.test?secret=JBSWY3DPEHPK3PXP',
          },
        }),
      ),
      challengeAndVerify: vi.fn(() => ok({})),
      unenroll: vi.fn(() => ok({ id: 'factor' })),
    },
  };

  const client = {
    auth,
    from: vi.fn((table: string) => {
      lastTable = table;
      return query;
    }),
    rpc: vi.fn((name: string) => ok(state.rpc[name] ?? null)),
  };

  return {
    client: client as unknown as SupabaseClient,
    mocks: client,
    query,
    state,
    /** Simulates Supabase notifying the app, e.g. after sign-in or MFA. */
    emit,
  };
}

export type FakeSupabase = ReturnType<typeof createFakeSupabase>;
