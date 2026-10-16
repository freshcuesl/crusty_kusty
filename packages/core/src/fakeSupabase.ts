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

  /**
   * Shared spies record every call so tests can assert on them. Each from(table)
   * gets its own builder, so queries running at the same time never mix tables.
   */
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    is: vi.fn(),
    order: vi.fn(),
    delete: vi.fn(),
    range: vi.fn(),
    in: vi.fn(),
    maybeSingle: vi.fn((_table?: string) => ok(state.membership)),
    single: vi.fn((table?: string) => ok(state.tables[table ?? '']?.[0] ?? null)),
  };

  type Builder = Record<string, unknown>;
  const chainable = ['select', 'eq', 'is', 'order', 'delete', 'range', 'in'] as const;
  const builderFor = (table: string): Builder => {
    const builder: Builder = {};
    for (const name of chainable) {
      builder[name] = (...args: unknown[]) => {
        (query[name] as (...a: unknown[]) => unknown)(...args);
        return builder;
      };
    }
    builder.maybeSingle = () => query.maybeSingle(table);
    builder.single = () => query.single(table);
    // List queries are awaited directly, like the real query builder.
    builder.then = (
      resolve: (value: { data: unknown[]; error: null; count: number }) => unknown,
    ) => {
      const rows = state.tables[table] ?? [];
      return resolve({ data: rows, error: null, count: rows.length });
    };
    return builder;
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
            uri: 'otpauth://totp/ClientShield:owner@alpha.test?secret=JBSWY3DPEHPK3PXP',
          },
        }),
      ),
      challengeAndVerify: vi.fn(() => ok({})),
      unenroll: vi.fn(() => ok({ id: 'factor' })),
    },
  };

  type RpcResult = { data: unknown; error: unknown };
  const rpcOverrides = new Map<string, (args: unknown) => RpcResult | Promise<RpcResult>>();

  const bucket = {
    upload: vi.fn((path: string) => ok({ path })),
    remove: vi.fn((paths: string[]) => ok(paths.map((name) => ({ name })))),
    createSignedUrl: vi.fn((path: string) =>
      ok({ signedUrl: `https://storage.test/signed/${path}?token=t` }),
    ),
    download: vi.fn(() => ok(new Blob(['file contents']))),
  };
  const storage = { from: vi.fn(() => bucket) };

  const client = {
    auth,
    storage,
    from: vi.fn((table: string) => builderFor(table)),
    rpc: vi.fn((name: string, args?: unknown) => {
      const override = rpcOverrides.get(name);
      return override ? Promise.resolve(override(args)) : ok(state.rpc[name] ?? null);
    }),
    functions: {
      invoke: vi.fn((_name: string, _options?: unknown) =>
        ok({ url: 'https://verify.stripe.com/start/test' }),
      ),
    },
  };

  return {
    client: client as unknown as SupabaseClient,
    mocks: client,
    query,
    bucket,
    state,
    /** Answers supabase.rpc(name) with this result, whatever else the app calls first. */
    whenRpc(name: string, result: RpcResult | ((args: unknown) => RpcResult | Promise<RpcResult>)) {
      rpcOverrides.set(name, typeof result === 'function' ? result : () => result);
    },
    /** Simulates Supabase notifying the app, e.g. after sign-in or MFA. */
    emit,
  };
}

export type FakeSupabase = ReturnType<typeof createFakeSupabase>;
