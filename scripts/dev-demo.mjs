#!/usr/bin/env node
// LOCAL DEVELOPMENT ONLY: makes your business fully verified and adds sample data,
// so every screen can be tried. Usage: npm run dev:demo -- you@example.com
// It talks to the local database container through Docker, so it can never reach
// a hosted project.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseEmailArg } from './dev-verify-identity.mjs';

/** The sample customer that matches the demo incident. */
export const DEMO_CUSTOMER = {
  name: 'Jordan Demo',
  phone: '(206) 555-0142',
  email: 'jordan.demo@example.com',
};

/**
 * The local database container is named after project_id in supabase/config.toml.
 * @param {string} configText
 */
export function dbContainerName(configText) {
  const match = /^project_id\s*=\s*"([^"]+)"/m.exec(configText);
  if (!match) throw new Error('Could not find project_id in supabase/config.toml.');
  return `supabase_db_${match[1]}`;
}

/**
 * Turns psql's error into plain words.
 * @param {string} output
 */
export function demoErrorMessage(output) {
  if (output.includes('NO_BUSINESS')) {
    return "That account doesn't own a business yet. Sign in to the app with it and create the business first.";
  }
  if (/No such container|is not running|Cannot connect to the Docker daemon/i.test(output)) {
    return 'Local Supabase is not running. Start Docker Desktop, then run: npm run db:start';
  }
  return 'Demo setup failed. Run `npx supabase migration up`, then try again.';
}

function main() {
  const email = parseEmailArg(process.argv.slice(2));
  const root = new URL('..', import.meta.url);
  const container = dbContainerName(readFileSync(new URL('supabase/config.toml', root), 'utf8'));
  const sql = readFileSync(new URL('scripts/dev-demo.sql', root), 'utf8');

  try {
    execFileSync(
      'docker',
      ['exec', '-i', container, 'psql', '-U', 'postgres', '-q', '-v', `email=${email}`],
      { input: sql, stdio: ['pipe', 'pipe', 'pipe'], encoding: 'utf8' },
    );
  } catch (error) {
    const output = `${error.stdout ?? ''}${error.stderr ?? ''}${error.message ?? ''}`;
    throw new Error(demoErrorMessage(output));
  }

  console.log(`✔ ${email}'s business is fully verified (business and owner ID).`);
  console.log('✔ Sample data added: Demo Reporter Co with one verified incident.');
  console.log('');
  console.log('Try it: open the app, click Customer check, and enter');
  console.log(`  Name:  ${DEMO_CUSTOMER.name}`);
  console.log(`  Phone: ${DEMO_CUSTOMER.phone}`);
  console.log('You should see "Verified incident found".');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    main();
  } catch (error) {
    console.error(`✘ ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
