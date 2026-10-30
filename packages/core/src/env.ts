export interface AppConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
}

/** True for an absolute http(s) URL. Plain code instead of a validation library: smaller app. */
function isUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

const SETUP_HINT = 'See docs/setup/01-run-the-app-locally.md.';

/** Reads the JWT "role" claim without verifying it; only used to block admin keys. */
function jwtRole(key: string): string | undefined {
  const payload = key.split('.')[1];
  if (!payload) return undefined;
  try {
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as {
      role?: unknown;
    };
    return typeof decoded.role === 'string' ? decoded.role : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Validates the browser's environment variables. Fails loudly at startup rather
 * than letting the app run half-configured, and refuses admin-level keys, which
 * would bypass row-level security if they ever reached a browser.
 */
export function parseEnv(env: Record<string, unknown>): AppConfig {
  const url = env.VITE_SUPABASE_URL;
  const key = env.VITE_SUPABASE_ANON_KEY;
  const problems = [
    ...(isUrl(url) ? [] : ['VITE_SUPABASE_URL']),
    ...(typeof key === 'string' && key.length > 0 ? [] : ['VITE_SUPABASE_ANON_KEY']),
  ];
  if (problems.length > 0 || !isUrl(url) || typeof key !== 'string') {
    throw new Error(
      `Missing or invalid environment variables: ${problems.join(', ')}. ${SETUP_HINT}`,
    );
  }

  if (key.startsWith('sb_secret_')) {
    throw new Error(
      `VITE_SUPABASE_ANON_KEY is a secret key. Use the publishable key. ${SETUP_HINT}`,
    );
  }
  if (jwtRole(key) === 'service_role') {
    throw new Error(
      `VITE_SUPABASE_ANON_KEY is a service_role key. Use the anon key. ${SETUP_HINT}`,
    );
  }

  return { supabaseUrl: url, supabaseAnonKey: key };
}
