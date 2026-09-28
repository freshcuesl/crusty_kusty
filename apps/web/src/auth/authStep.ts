import type { AuthenticatorAssuranceLevels } from '@supabase/supabase-js';

export type AssuranceLevel = AuthenticatorAssuranceLevels | null;

export interface Membership {
  role: 'owner' | 'staff';
  businessId: string;
  businessName: string;
  verificationStatus: 'unverified' | 'pending' | 'verified' | 'rejected' | 'suspended';
}

/** Everything needed to decide where a user belongs right now. */
export interface AuthSnapshot {
  loading: boolean;
  hasSession: boolean;
  currentLevel: AssuranceLevel;
  nextLevel: AssuranceLevel;
  membership: Membership | null;
}

export type AuthStep =
  'loading' | 'signed-out' | 'mfa-setup' | 'mfa-verify' | 'onboarding' | 'ready';

/**
 * The single source of truth for the sign-in funnel:
 * sign in → two-step login (set up or verify) → join or create a business → app.
 */
export function resolveAuthStep(s: AuthSnapshot): AuthStep {
  if (s.loading) return 'loading';
  if (!s.hasSession) return 'signed-out';
  if (s.currentLevel !== 'aal2') {
    return s.nextLevel === 'aal2' ? 'mfa-verify' : 'mfa-setup';
  }
  if (!s.membership) return 'onboarding';
  return 'ready';
}

const PATHS: Record<Exclude<AuthStep, 'loading'>, string> = {
  'signed-out': '/sign-in',
  'mfa-setup': '/mfa/setup',
  'mfa-verify': '/mfa/verify',
  onboarding: '/onboarding',
  ready: '/',
};

export function pathForStep(step: Exclude<AuthStep, 'loading'>): string {
  return PATHS[step];
}
