import { describe, expect, it } from 'vitest';
import { PLANS as STRIPE_PRICES } from '../../../../scripts/stripe-setup-plans.mjs';
import { PLANS } from './plans';

describe('plans shown in the app', () => {
  it('show the same prices Stripe charges', () => {
    for (const price of STRIPE_PRICES) {
      const plan = PLANS.find((p) => p.tier === price.tier);
      expect(plan?.price?.[price.interval], price.lookupKey).toBe(price.amount / 100);
    }
  });

  it('list every plan, cheapest first', () => {
    expect(PLANS.map((p) => p.tier)).toEqual(['free', 'pro', 'team', 'business']);
  });
});
