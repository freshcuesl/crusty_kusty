#!/usr/bin/env node
// Creates ClientShield's plans in Stripe: the Pro and Team products, their
// monthly and yearly prices (found later by lookup key), and the billing portal
// settings. Safe to run again: anything already right is reused.
// Usage: npm run stripe:setup-plans            (test mode key from supabase/functions/.env)
//        npm run stripe:setup-plans -- --live  (only when launching, with the live key)

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Prices in cents. Yearly is ten months: two months free. */
export const PLANS = [
  { tier: 'pro', interval: 'month', amount: 2900, lookupKey: 'clientshield_pro_month' },
  { tier: 'pro', interval: 'year', amount: 29000, lookupKey: 'clientshield_pro_year' },
  { tier: 'team', interval: 'month', amount: 5900, lookupKey: 'clientshield_team_month' },
  { tier: 'team', interval: 'year', amount: 59000, lookupKey: 'clientshield_team_year' },
];

const PRODUCTS = {
  pro: { name: 'ClientShield Pro', description: 'Unlimited customer checks, up to 3 users.' },
  team: { name: 'ClientShield Team', description: 'Unlimited customer checks, up to 15 users.' },
};

const ENV_FILE = fileURLToPath(new URL('../supabase/functions/.env', import.meta.url));

/**
 * @param {string} key
 * @param {string[]} args
 */
export function checkSecretKey(key, args) {
  if (!key || key.includes('replace_me')) {
    throw new Error(
      'Add your Stripe test secret key as STRIPE_SECRET_KEY in supabase/functions/.env (Guide 4).',
    );
  }
  if (!/^(sk|rk)_(test|live)_/.test(key)) {
    throw new Error('STRIPE_SECRET_KEY must be a secret key (it starts with sk_test_).');
  }
  if (key.includes('_live_') && !args.includes('--live')) {
    throw new Error('That is a LIVE key. Only use it at launch, with --live.');
  }
}

/**
 * @param {string} text
 * @param {string} name
 */
export function readEnvValue(text, name) {
  for (const line of text.split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (match && match[1] === name) return match[2].replace(/^["']|["']$/g, '');
  }
  return '';
}

/**
 * Stripe's form encoding: nested objects become a[b]=c, arrays a[0]=x.
 * @param {Record<string, unknown>} value
 * @param {string} [prefix]
 * @returns {string}
 */
export function formEncode(value, prefix = '') {
  const parts = [];
  for (const [key, item] of Object.entries(value)) {
    if (item === undefined) continue;
    const name = prefix ? `${prefix}[${key}]` : key;
    if (item !== null && typeof item === 'object') {
      parts.push(formEncode(/** @type {Record<string, unknown>} */ (item), name));
    } else {
      parts.push(`${encodeURIComponent(name)}=${encodeURIComponent(String(item))}`);
    }
  }
  return parts.filter(Boolean).join('&');
}

/**
 * @typedef {(method: string, path: string, body?: Record<string, unknown>) => Promise<any>} StripeCall
 * @param {StripeCall} call
 * @param {(line: string) => void} log
 */
export async function setupPlans(call, log) {
  const lookupQuery = PLANS.map((p, i) => `lookup_keys[${i}]=${p.lookupKey}`).join('&');
  const existing = (await call('GET', `/v1/prices?active=true&limit=100&${lookupQuery}`)).data;

  /** @type {Record<string, string>} */
  const productIds = {};
  for (const tier of /** @type {const} */ (['pro', 'team'])) {
    const fromPrice = existing.find((/** @type {any} */ p) => p.lookup_key?.includes(`_${tier}_`));
    if (fromPrice) {
      productIds[tier] =
        typeof fromPrice.product === 'string' ? fromPrice.product : fromPrice.product.id;
      continue;
    }
    const query = encodeURIComponent(`metadata['clientshield_tier']:'${tier}'`);
    const found = (await call('GET', `/v1/products/search?query=${query}`)).data[0];
    if (found) {
      productIds[tier] = found.id;
    } else {
      const product = await call('POST', '/v1/products', {
        ...PRODUCTS[tier],
        metadata: { clientshield_tier: tier },
      });
      productIds[tier] = product.id;
      log(`Created product ${PRODUCTS[tier].name}`);
    }
  }

  /** @type {Record<string, string>} */
  const priceIds = {};
  for (const plan of PLANS) {
    const current = existing.find((/** @type {any} */ p) => p.lookup_key === plan.lookupKey);
    if (
      current &&
      current.unit_amount === plan.amount &&
      current.recurring?.interval === plan.interval
    ) {
      priceIds[plan.lookupKey] = current.id;
      log(`Price ${plan.lookupKey} is already set up`);
      continue;
    }
    // A new price takes over the lookup key; existing subscribers keep their old price.
    const price = await call('POST', '/v1/prices', {
      product: productIds[plan.tier],
      currency: 'usd',
      unit_amount: plan.amount,
      recurring: { interval: plan.interval },
      lookup_key: plan.lookupKey,
      transfer_lookup_key: true,
      metadata: { clientshield_tier: plan.tier },
    });
    priceIds[plan.lookupKey] = price.id;
    log(`Created price ${plan.lookupKey} ($${plan.amount / 100}/${plan.interval})`);
  }

  const portal = {
    business_profile: { headline: 'ClientShield: manage your plan and billing' },
    features: {
      customer_update: { enabled: true, allowed_updates: ['email', 'address', 'name'] },
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      subscription_cancel: { enabled: true, mode: 'at_period_end' },
      subscription_update: {
        enabled: true,
        default_allowed_updates: ['price'],
        proration_behavior: 'create_prorations',
        products: ['pro', 'team'].map((tier) => ({
          product: productIds[tier],
          prices: PLANS.filter((p) => p.tier === tier).map((p) => priceIds[p.lookupKey]),
        })),
      },
    },
    metadata: { app: 'clientshield' },
  };
  const configs = (await call('GET', '/v1/billing_portal/configurations?active=true&limit=100'))
    .data;
  const mine = configs.find((/** @type {any} */ c) => c.metadata?.app === 'clientshield');
  if (mine) {
    await call('POST', `/v1/billing_portal/configurations/${mine.id}`, portal);
    log('Updated the billing portal settings');
  } else {
    await call('POST', '/v1/billing_portal/configurations', portal);
    log('Created the billing portal settings');
  }
}

async function main() {
  const args = process.argv.slice(2);
  let envText = '';
  try {
    envText = readFileSync(ENV_FILE, 'utf8');
  } catch {
    throw new Error(
      'Copy supabase/functions/.env.example to supabase/functions/.env first (Guide 4).',
    );
  }
  const key = readEnvValue(envText, 'STRIPE_SECRET_KEY');
  checkSecretKey(key, args);

  /** @type {StripeCall} */
  const call = async (method, path, body) => {
    const res = await fetch(`https://api.stripe.com${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body ? formEncode(body) : undefined,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`Stripe said: ${data?.error?.message ?? res.status}`);
    return data;
  };

  await setupPlans(call, (line) => console.log(`  ✔ ${line}`));
  console.log('\nDone. Plans are ready in Stripe.');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(`\n✖ ${error instanceof Error ? error.message : error}\n`);
    process.exit(1);
  });
}
