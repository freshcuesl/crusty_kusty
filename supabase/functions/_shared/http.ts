// Small HTTP helpers shared by the Edge Functions.

/** CORS headers that allow only the web app's own origin. */
export function corsHeaders(appUrl: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': new URL(appUrl).origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

export function json(
  body: unknown,
  status: number,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}
