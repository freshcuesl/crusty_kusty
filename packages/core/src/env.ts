import { z } from 'zod';

export interface AppConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
}

const schema = z.object({
  VITE_SUPABASE_URL: z.url(),
  VITE_SUPABASE_ANON_KEY: z.string().min(1),
});

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
  const result = schema.safeParse(env);
  if (!result.success) {
    const problems = result.error.issues.map((issue) => issue.path.join('.')).join(', ');
    throw new Error(`Missing or invalid environment variables: ${problems}. ${SETUP_HINT}`);
  }

  const key = result.data.VITE_SUPABASE_ANON_KEY;
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

  return { supabaseUrl: result.data.VITE_SUPABASE_URL, supabaseAnonKey: key };
}
