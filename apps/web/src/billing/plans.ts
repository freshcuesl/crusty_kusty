import type { Tier } from './subscription';

export interface PlanInfo {
  tier: Tier;
  name: string;
  /** Who it's for, in a few words. */
  tagline: string;
  /** Dollars per month and per year; null means "Contact us". */
  price: { month: number; year: number } | null;
  features: string[];
}

// The one place the app describes the plans: the landing page and Plan and billing both
// use it. Prices must match scripts/stripe-setup-plans.mjs (a test checks), and limits the
// plans table in the database.
export const PLANS: PlanInfo[] = [
  {
    tier: 'free',
    name: 'Free',
    tagline: 'Try it on your next jobs',
    price: { month: 0, year: 0 },
    features: ['10 customer checks a month', '1 user', 'Incident reports and alerts'],
  },
  {
    tier: 'pro',
    name: 'Pro',
    tagline: 'For owner-operators',
    price: { month: 29, year: 290 },
    features: ['Unlimited customer checks', 'Up to 3 users', 'Everything in Free'],
  },
  {
    tier: 'team',
    name: 'Team',
    tagline: 'For crews and offices',
    price: { month: 59, year: 590 },
    features: ['Unlimited customer checks', 'Up to 15 users', 'Everything in Pro'],
  },
  {
    tier: 'business',
    name: 'Business',
    tagline: 'For larger companies',
    price: null,
    features: ['CRM and API connections', 'More users', 'Contact us to set it up'],
  },
];
