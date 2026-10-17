export interface StripePlan {
  tier: 'pro' | 'team';
  interval: 'month' | 'year';
  /** Cents. */
  amount: number;
  lookupKey: string;
}

export const PLANS: StripePlan[];
export function checkSecretKey(key: string, args: string[]): void;
export function readEnvValue(text: string, name: string): string;
export function formEncode(value: Record<string, unknown>, prefix?: string): string;
export function setupPlans(
  call: (method: string, path: string, body?: Record<string, unknown>) => Promise<unknown>,
  log: (line: string) => void,
): Promise<void>;
