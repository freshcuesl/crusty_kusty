// Builds the Cloudflare `_headers` file for each app at build time, so the
// Content-Security-Policy names the real Supabase project (and Sentry, when on)
// instead of a wildcard. Used by apps/web and apps/admin vite.config.ts.

/**
 * @param {string | undefined} url
 * @returns {URL | null}
 */
function parse(url) {
  try {
    return url ? new URL(url) : null;
  } catch {
    return null;
  }
}

/**
 * Origins the browser may talk to besides the app itself.
 * @param {{ supabaseUrl?: string; sentryDsn?: string }} options
 */
export function cspSources({ supabaseUrl, sentryDsn }) {
  const supabase = parse(supabaseUrl);
  /** @type {string[]} */
  const connect = [];
  /** @type {string[]} */
  const img = [];
  if (supabase) {
    const socket = supabase.protocol === 'https:' ? 'wss:' : 'ws:';
    connect.push(supabase.origin, `${socket}//${supabase.host}`);
    img.push(supabase.origin);
  } else {
    connect.push('https://*.supabase.co', 'wss://*.supabase.co');
    img.push('https://*.supabase.co');
  }
  const sentry = parse(sentryDsn);
  // Only the host: the DSN's public key never needs to be in a header.
  if (sentry && sentry.protocol === 'https:') connect.push(sentry.origin);
  return { connect, img };
}

/**
 * @param {{ supabaseUrl?: string; sentryDsn?: string; admin?: boolean }} options
 * @returns {string}
 */
export function buildSecurityHeaders({ supabaseUrl, sentryDsn, admin = false }) {
  const { connect, img } = cspSources({ supabaseUrl, sentryDsn });
  const policy = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${img.join(' ')}`,
    "font-src 'self'",
    `connect-src 'self' ${connect.join(' ')}`,
    "worker-src 'self'",
    "manifest-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    'upgrade-insecure-requests',
  ].join('; ');

  const lines = [
    '# Generated at build time by scripts/security-headers.mjs. Do not edit by hand.',
    '/*',
    `  Content-Security-Policy: ${policy}`,
    '  Strict-Transport-Security: max-age=63072000; includeSubDomains; preload',
    '  X-Content-Type-Options: nosniff',
    '  X-Frame-Options: DENY',
    '  Referrer-Policy: strict-origin-when-cross-origin',
    // The web app uses the camera for evidence photos; the admin panel never does.
    `  Permissions-Policy: camera=${admin ? '()' : '(self)'}, microphone=(), geolocation=(), payment=(), usb=()`,
    '  Cross-Origin-Opener-Policy: same-origin',
    ...(admin ? ['  X-Robots-Tag: noindex, nofollow'] : []),
    '',
    '/sw.js',
    '  Cache-Control: no-cache',
    '',
    '/assets/*',
    '  Cache-Control: public, max-age=31536000, immutable',
    '',
  ];
  return lines.join('\n');
}

/**
 * Vite plugin: writes `_headers` into the build output.
 * @param {{ supabaseUrl?: string; sentryDsn?: string; admin?: boolean }} options
 * @returns {import('vite').Plugin}
 */
export function securityHeaders(options) {
  return {
    name: 'clientshield-security-headers',
    apply: 'build',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: '_headers', source: buildSecurityHeaders(options) });
    },
  };
}
