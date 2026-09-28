#!/usr/bin/env node
// Gives a local account the moderator (default) or admin role.
// Usage: npm run make-admin -- you@example.com [--admin]
// Local development only: it refuses to run against a hosted Supabase project.

import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const USAGE = 'Usage: npm run make-admin -- you@example.com [--admin]';

/** @param {string[]} args */
export function parseMakeAdminArgs(args) {
  const email = (args.find((a) => !a.startsWith('--')) ?? '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new Error(`Give the email of an account that already signed up. ${USAGE}`);
  }
  return { email, role: args.includes('--admin') ? 'admin' : 'moderator' };
}

/** @param {string} url */
export function assertLocalUrl(url) {
  const host = new URL(url).hostname;
  if (host !== '127.0.0.1' && host !== 'localhost') {
    throw new Error(
      'make-admin only works on the local database. Use the SQL editor for hosted projects.',
    );
  }
}

async function main() {
  const { email, role } = parseMakeAdminArgs(process.argv.slice(2));

  let status;
  try {
    status = JSON.parse(execSync('npx supabase status -o json', { encoding: 'utf8' }));
  } catch {
    throw new Error('Local Supabase is not running. Start it first with: npm run db:start');
  }
  const url = status.API_URL;
  const adminKey = status.SECRET_KEY ?? status.SERVICE_ROLE_KEY;
  assertLocalUrl(url);

  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(url, adminKey, { auth: { persistSession: false } });

  let user;
  for (let page = 1; !user; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    user = data.users.find((u) => u.email?.toLowerCase() === email);
    if (data.users.length < 1000) break;
  }
  if (!user) throw new Error(`No account for ${email}. Sign up in the app first.`);

  const { error } = await supabase
    .from('platform_roles')
    .upsert({ user_id: user.id, role }, { onConflict: 'user_id' });
  if (error) throw error;

  console.log(`✔ ${email} is now a ${role}. Sign in at http://localhost:5174`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(`✘ ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
}
