#!/usr/bin/env node
// Security audit gate for CI: fails on any high or critical npm advisory, except the
// few listed in scripts/audit-allowlist.json, each with a reason and an expiry date.
// After its expiry date an entry stops counting, so the audit fails again and the
// advisory gets looked at. Usage: npm run audit

import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const BLOCKING = new Set(['high', 'critical']);

/**
 * @typedef {{ id: string; package: string; reason: string; expires: string }} AllowEntry
 * @typedef {{ package: string; severity: string; ids: string[]; titles: string[] }} Finding
 */

/**
 * Turns `npm audit --json` output into one finding per vulnerable package.
 * @param {any} report
 * @returns {Finding[]}
 */
export function findingsFrom(report) {
  const findings = [];
  for (const [name, vuln] of Object.entries(report.vulnerabilities ?? {})) {
    const advisories = (vuln.via ?? []).filter((v) => typeof v === 'object' && v.url);
    if (advisories.length === 0) continue; // Only affected through another package.
    findings.push({
      package: name,
      severity: vuln.severity,
      ids: advisories.map((a) => String(a.url).split('/').pop()),
      titles: advisories.map((a) => a.title),
    });
  }
  return findings;
}

/**
 * The findings that should fail the build.
 * @param {Finding[]} findings
 * @param {AllowEntry[]} allowlist
 * @param {Date} today
 */
export function blockingFindings(findings, allowlist, today) {
  const active = allowlist.filter((entry) => new Date(`${entry.expires}T23:59:59Z`) >= today);
  return findings.filter(
    (finding) =>
      BLOCKING.has(finding.severity) &&
      !finding.ids.every((id) =>
        active.some((entry) => entry.id === id && entry.package === finding.package),
      ),
  );
}

/**
 * Allowlist entries past their expiry date, to point out in the output.
 * @param {AllowEntry[]} allowlist
 * @param {Date} today
 */
export function expiredEntries(allowlist, today) {
  return allowlist.filter((entry) => new Date(`${entry.expires}T23:59:59Z`) < today);
}

function main() {
  const allowlist = JSON.parse(
    readFileSync(new URL('./audit-allowlist.json', import.meta.url), 'utf8'),
  ).advisories;
  let output;
  try {
    output = execSync('npm audit --json', { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
  } catch (error) {
    // npm audit exits non-zero when it finds anything; the JSON is still on stdout.
    output = error.stdout;
  }
  const findings = findingsFrom(JSON.parse(output));
  const today = new Date();
  for (const entry of expiredEntries(allowlist, today)) {
    console.log(`! Allowlist entry expired on ${entry.expires}: ${entry.id} (${entry.package})`);
  }
  const blocking = blockingFindings(findings, allowlist, today);
  for (const finding of blocking) {
    console.error(`✖ ${finding.severity}: ${finding.package}: ${finding.titles.join('; ')}`);
  }
  const allowed = findings.filter((f) => BLOCKING.has(f.severity) && !blocking.includes(f));
  for (const finding of allowed) {
    console.log(`• allowed until reviewed: ${finding.package} (${finding.ids.join(', ')})`);
  }
  if (blocking.length > 0) process.exit(1);
  console.log('✔ No high or critical advisories outside the reviewed allowlist.');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
