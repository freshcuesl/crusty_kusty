import { friendlyError } from './friendlyError';

/** Reads the {error} message our Edge Functions return, or a friendly fallback. */
export async function functionErrorMessage(error: unknown): Promise<string> {
  const context = (error as { context?: unknown } | null)?.context;
  if (context instanceof Response) {
    try {
      const body = (await context.clone().json()) as { error?: unknown };
      if (typeof body.error === 'string') return body.error;
    } catch {
      // Not JSON; fall through.
    }
  }
  return friendlyError(error);
}
