import type { User } from '@supabase/supabase-js';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { resolveAuthStep, type AuthSnapshot, type AuthStep, type Membership } from './authStep';
import { useSupabase } from './SupabaseProvider';

export interface AuthContextValue {
  step: AuthStep;
  user: User | null;
  membership: Membership | null;
  /** 'moderator' or 'admin' for ClientShield staff; null for everyone else. */
  platformRole: PlatformRole | null;
  /** Re-reads session, two-step status and business, e.g. after joining a business. */
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export type PlatformRole = 'moderator' | 'admin';

interface State extends AuthSnapshot {
  user: User | null;
  platformRole: PlatformRole | null;
}

const INITIAL: State = {
  loading: true,
  hasSession: false,
  currentLevel: null,
  nextLevel: null,
  membership: null,
  user: null,
  platformRole: null,
};

const SIGNED_OUT: State = { ...INITIAL, loading: false };

interface MembershipRow {
  role: Membership['role'];
  business: { id: string; name: string; verification_status: Membership['verificationStatus'] };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = useSupabase();
  const [state, setState] = useState<State>(INITIAL);
  const latestRequest = useRef(0);

  const load = useCallback(async () => {
    const request = ++latestRequest.current;
    const apply = (next: State) => {
      if (request === latestRequest.current) setState(next);
    };

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return apply(SIGNED_OUT);

      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      const currentLevel = aal?.currentLevel ?? null;
      const nextLevel = aal?.nextLevel ?? null;

      // Business data is protected by two-step login, so only ask once it's done.
      let membership: Membership | null = null;
      let platformRole: PlatformRole | null = null;
      if (currentLevel === 'aal2') {
        // Independent questions, asked together: one round trip instead of two.
        const [{ data: role }, { data }] = await Promise.all([
          supabase.rpc('my_platform_role'),
          supabase
            .from('business_members')
            .select('role, business:businesses(id, name, verification_status)')
            .eq('user_id', session.user.id)
            .maybeSingle<MembershipRow>(),
        ]);
        platformRole = role === 'moderator' || role === 'admin' ? role : null;
        if (data) {
          membership = {
            role: data.role,
            businessId: data.business.id,
            businessName: data.business.name,
            verificationStatus: data.business.verification_status,
          };
        }
      }

      apply({
        loading: false,
        hasSession: true,
        currentLevel,
        nextLevel,
        membership,
        user: session.user,
        platformRole,
      });
    } catch {
      apply(SIGNED_OUT);
    }
  }, [supabase]);

  useEffect(() => {
    void load();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      // Supabase advises against awaiting its own calls inside this callback.
      setTimeout(() => void load(), 0);
    });
    return () => subscription.unsubscribe();
  }, [supabase, load]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    await load();
  }, [supabase, load]);

  const value = useMemo<AuthContextValue>(
    () => ({
      step: resolveAuthStep(state),
      user: state.user,
      membership: state.membership,
      platformRole: state.platformRole,
      refresh: load,
      signOut,
    }),
    [state, load, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>');
  return value;
}
