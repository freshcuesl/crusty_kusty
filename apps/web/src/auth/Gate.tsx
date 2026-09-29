import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useAuth } from './AuthProvider';
import { pathForStep, type AuthStep } from './authStep';
import { FullPageSpinner } from './ui';

interface GateProps {
  /** The auth steps allowed to see this page. Everyone else is redirected to their next step. */
  allow: AuthStep[];
  /** Remember this page so users return here after signing in. */
  rememberAsDestination?: boolean;
  children: ReactNode;
}

interface GateState {
  from?: string;
}

export function Gate({ allow, rememberAsDestination = false, children }: GateProps) {
  const { step } = useAuth();
  const location = useLocation();

  if (step === 'loading') return <FullPageSpinner />;
  if (allow.includes(step)) return <>{children}</>;

  const remembered = (location.state as GateState | null)?.from;
  const from =
    remembered ?? (rememberAsDestination ? location.pathname + location.search : undefined);

  if (step === 'ready') {
    return <Navigate to={from ?? pathForStep('ready')} replace />;
  }
  return <Navigate to={pathForStep(step)} replace state={from ? { from } : null} />;
}
