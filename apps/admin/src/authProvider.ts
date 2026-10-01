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

export function createAuthProvider(supabase: SupabaseClient): AuthProvider {
  return {
    // The login page signs in and verifies the code itself; this confirms the result.
    async login() {
      const check = await checkAdmin(supabase);
      if (!check.ok) {
        if (check.reason === 'not-staff') await supabase.auth.signOut();
        throw new Error(ADMIN_MESSAGES[check.reason]);
      }
    },
    async logout() {
      await supabase.auth.signOut();
    },
    async checkAuth() {
      const check = await checkAdmin(supabase);
      if (!check.ok) throw new Error(ADMIN_MESSAGES[check.reason]);
    },
    async checkError(error: { status?: number } | undefined) {
      if (error?.status === 401 || error?.status === 403) throw new Error('Session expired');
    },
    async getPermissions() {
      const check = await checkAdmin(supabase);
      return check.ok ? check.role : null;
    },
    async getIdentity() {
      const check = await checkAdmin(supabase);
      if (!check.ok) throw new Error(ADMIN_MESSAGES[check.reason]);
      return { id: check.user.id, fullName: check.user.email ?? '' };
    },
  };
}
