#!/usr/bin/env node
// LOCAL DEVELOPMENT ONLY: marks a business owner's identity as verified without
// Stripe, so the verification flow can be tried before Stripe test keys exist.
// Usage: npm run dev:verify-identity -- you@example.com
// Refuses to run against anything but the local database.

import { execSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { assertLocalUrl } from './make-admin.mjs';

const USAGE = 'Usage: npm run dev:verify-identity -- you@example.com';

/** @param {string[]} args */
export function parseEmailArg(args) {
  const email = (args.find((a) => !a.startsWith('--')) ?? '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new Error(`Give the business owner's email. ${USAGE}`);
  }
  return email;
}

/**
 * @param {string} userId
 * @param {string} businessId
 * @param {() => string} randomId
 */
export function localIdentityRow(
  userId,
  businessId,
  randomId = () => randomBytes(8).toString('hex'),
) {
  return {
    business_id: businessId,
    user_id: userId,
    // The prefix makes these easy to spot; they never exist in a hosted project.
    stripe_session_id: `vs_localdev_${randomId()}`,
    status: 'verified',
  };
}

async function main() {
  const email = parseEmailArg(process.argv.slice(2));
  let status;
  try {
    status = JSON.parse(execSync('npx supabase status -o json', { encoding: 'utf8' }));
  } catch {
    throw new Error('Local Supabase is not running. Start it first with: npm run db:start');
  }
  assertLocalUrl(status.API_URL);

  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(status.API_URL, status.SECRET_KEY ?? status.SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { data: users, error: usersError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (usersError) throw usersError;
  const user = users.users.find((u) => u.email?.toLowerCase() === email);
  if (!user) throw new Error(`No account for ${email}. Sign up in the app first.`);

  const { data: membership, error: memberError } = await supabase
    .from('business_members')
    .select('business_id')
    .eq('user_id', user.id)
    .eq('role', 'owner')
    .maybeSingle();
  if (memberError) throw memberError;
  if (!membership)
    throw new Error(`${email} doesn't own a business yet. Create one in the app first.`);

  const { error } = await supabase
    .from('owner_identity_checks')
    .insert(localIdentityRow(user.id, membership.business_id));
  if (error) throw error;

  console.log(`✔ ${email}'s identity is marked verified (local test only).`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(`✘ ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
}
