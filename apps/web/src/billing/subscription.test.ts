import { describe, expect, it } from 'vitest';
import { daysLeft, isOnTrial, isPaid, type Subscription } from './subscription';

const now = new Date('2026-10-21T12:00:00Z');
const base = {
  tier: 'pro',
  status: 'none',
  trial_ends_at: '2026-10-25T12:00:00Z',
} as Subscription;

describe('subscription helpers', () => {
  it('knows paying statuses, including a payment Stripe is retrying', () => {
    expect(isPaid({ ...base, status: 'active' })).toBe(true);
    expect(isPaid({ ...base, status: 'past_due' })).toBe(true);
    expect(isPaid({ ...base, status: 'canceled' })).toBe(false);
  });

  it('knows when the free trial is running', () => {
    expect(isOnTrial(base, now)).toBe(true);
    expect(isOnTrial({ ...base, trial_ends_at: '2026-10-01T00:00:00Z' }, now)).toBe(false);
    expect(isOnTrial({ ...base, trial_ends_at: null }, now)).toBe(false);
    expect(isOnTrial({ ...base, status: 'active' }, now)).toBe(false);
    expect(isOnTrial({ ...base, tier: 'free' }, now)).toBe(false);
  });

  it('counts whole days left, never below zero', () => {
    expect(daysLeft('2026-10-25T12:00:00Z', now)).toBe(4);
    expect(daysLeft('2026-10-21T13:00:00Z', now)).toBe(1);
    expect(daysLeft('2026-10-01T00:00:00Z', now)).toBe(0);
  });
});
