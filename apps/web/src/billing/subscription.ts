import { useEffect, useState } from 'react';
import { friendlyError } from '@cs/core';
import { useSupabase } from '../auth/SupabaseProvider';

export type Tier = 'free' | 'pro' | 'team' | 'business';
export type Interval = 'month' | 'year';

/** What my_subscription() returns: the plan in force, usage and billing state. */
export interface Subscription {
  tier: Tier;
  plan_name: string;
  monthly_checks: number | null;
  max_members: number;
  checks_used: number;
  members: number;
  status: string;
  billing_interval: Interval | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  trial_ends_at: string | null;
  has_billing_account: boolean;
  can_manage: boolean;
}

/** Paying (or being retried) through Stripe. */
export function isPaid(sub: Subscription): boolean {
  return ['active', 'trialing', 'past_due'].includes(sub.status);
}

/** On ClientShield's own 14-day trial (no card yet). */
export function isOnTrial(sub: Subscription, now = new Date()): boolean {
  return (
    !isPaid(sub) &&
    sub.tier === 'pro' &&
    !!sub.trial_ends_at &&
    Date.parse(sub.trial_ends_at) > now.getTime()
  );
}

export function daysLeft(iso: string, now = new Date()): number {
  return Math.max(0, Math.ceil((Date.parse(iso) - now.getTime()) / 86_400_000));
}

export function useSubscription() {
  const supabase = useSupabase();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    supabase.rpc('my_subscription').then(
      ({ data, error: rpcError }) => {
        if (!active) return;
        if (rpcError) setError(friendlyError(rpcError));
        else setSubscription((data as Subscription | null) ?? null);
      },
      (thrown: unknown) => active && setError(friendlyError(thrown)),
    );
    return () => {
      active = false;
    };
  }, [supabase]);

  return { subscription, error };
}
