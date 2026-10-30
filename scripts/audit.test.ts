import { describe, expect, it } from 'vitest';
import { blockingFindings, expiredEntries, findingsFrom } from './audit.mjs';

const report = {
  vulnerabilities: {
    'decode-uri-component': {
      severity: 'high',
      via: [
        { title: 'DoS', url: 'https://github.com/advisories/GHSA-vcc3-ghjq-m6fr' },
        { title: 'DoS 2', url: 'https://github.com/advisories/GHSA-qr28-fpjm-wq7f' },
      ],
    },
    'query-string': { severity: 'high', via: ['decode-uri-component'] },
    undici: {
      severity: 'critical',
      via: [{ title: 'TLS bypass', url: 'https://github.com/advisories/GHSA-2m5v-pch6-74hx' }],
    },
    deepmerge: { severity: 'low', via: [{ title: 'meh', url: 'https://x/GHSA-low' }] },
  },
};

const allow = [
  {
    id: 'GHSA-vcc3-ghjq-m6fr',
    package: 'decode-uri-component',
    reason: 'r',
    expires: '2026-11-30',
  },
  {
    id: 'GHSA-qr28-fpjm-wq7f',
    package: 'decode-uri-component',
    reason: 'r',
    expires: '2026-11-30',
  },
];

describe('security audit gate', () => {
  const findings = findingsFrom(report);
  const today = new Date('2026-10-29T12:00:00Z');

  it('reads one finding per package that is itself vulnerable', () => {
    expect(findings.map((f) => f.package).sort()).toEqual([
      'decode-uri-component',
      'deepmerge',
      'undici',
    ]);
  });

  it('fails on high and critical advisories that are not allowlisted', () => {
    expect(blockingFindings(findings, allow, today).map((f) => f.package)).toEqual(['undici']);
  });

  it('ignores low and moderate advisories, like npm audit --audit-level=high', () => {
    expect(blockingFindings(findings, [], today).map((f) => f.package)).not.toContain('deepmerge');
  });

  it('stops allowing an advisory after its expiry date', () => {
    const later = new Date('2026-12-01T00:00:00Z');
    expect(blockingFindings(findings, allow, later).map((f) => f.package)).toContain(
      'decode-uri-component',
    );
    expect(expiredEntries(allow, later)).toHaveLength(2);
    expect(expiredEntries(allow, today)).toHaveLength(0);
  });

  it('needs every advisory on a package allowlisted, not just one', () => {
    expect(blockingFindings(findings, [allow[0]!], today).map((f) => f.package)).toContain(
      'decode-uri-component',
    );
  });

  it('matches the advisory to the right package', () => {
    const wrongPackage = allow.map((a) => ({ ...a, package: 'something-else' }));
    expect(blockingFindings(findings, wrongPackage, today).map((f) => f.package)).toContain(
      'decode-uri-component',
    );
  });
});
