import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { AuthProvider } from 'react-admin';

type PlatformRole = 'moderator' | 'admin';

type AdminCheck =
  | { ok: true; role: PlatformRole; user: User }
  | { ok: false; reason: 'signed-out' | 'needs-code' | 'needs-mfa-setup' | 'not-staff' };

export const ADMIN_MESSAGES = {
  'signed-out': 'Sign in to continue.',
  'needs-code': 'Enter the code from your authenticator app.',
  'needs-mfa-setup': 'Set up two-step login in the ClientShield app first, then sign in here.',
  'not-staff': "This account doesn't have admin access.",
} as const;

/** Checks that the session has two-step login and a moderator or admin role. */
export async function checkAdmin(supabase: SupabaseClient): Promise<AdminCheck> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return { ok: false, reason: 'signed-out' };

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel !== 'aal2') {
    return { ok: false, reason: aal?.nextLevel === 'aal2' ? 'needs-code' : 'needs-mfa-setup' };
  }

  // The database only reveals the role to aal2 sessions.
  const { data: role } = await supabase.rpc('my_platform_role');
  if (role !== 'moderator' && role !== 'admin') return { ok: false, reason: 'not-staff' };

  return { ok: true, role, user: session.user };
}

/** How long a passing staff check is reused. The database checks every request anyway. */
export const ADMIN_CHECK_TTL_MS = 60_000;

export function createAuthProvider(
  supabase: SupabaseClient,
  now: () => number = () => Date.now(),
): AuthProvider {
  // react-admin asks on every page change. Reuse a passing check for the same sign-in
  // for a minute instead of asking the server each time; failures are never reused.
  let cached: { token: string; at: number; result: AdminCheck } | null = null;

  async function check(): Promise<AdminCheck> {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (cached && token && cached.token === token && now() - cached.at < ADMIN_CHECK_TTL_MS) {
      return cached.result;
    }
    const result = await checkAdmin(supabase);
    cached = result.ok && token ? { token, at: now(), result } : null;
    return result;
  }

  return {
    // The login page signs in and verifies the code itself; this confirms the result.
    async login() {
      cached = null;
      const result = await check();
      if (!result.ok) {
        if (result.reason === 'not-staff') await supabase.auth.signOut();
        throw new Error(ADMIN_MESSAGES[result.reason]);
      }
    },
    async logout() {
      cached = null;
      await supabase.auth.signOut();
    },
    async checkAuth() {
      const result = await check();
      if (!result.ok) throw new Error(ADMIN_MESSAGES[result.reason]);
    },
    async checkError(error: { status?: number } | undefined) {
      if (error?.status === 401 || error?.status === 403) {
        cached = null;
        throw new Error('Session expired');
      }
    },
    async getPermissions() {
      const result = await check();
      return result.ok ? result.role : null;
    },
    async getIdentity() {
      const result = await check();
      if (!result.ok) throw new Error(ADMIN_MESSAGES[result.reason]);
      return { id: result.user.id, fullName: result.user.email ?? '' };
    },
  };
}
