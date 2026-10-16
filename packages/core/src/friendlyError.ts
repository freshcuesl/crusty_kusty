const GENERIC = 'Something went wrong. Try again in a moment.';

const AUTH_MESSAGES: Record<string, string> = {
  invalid_credentials: 'Email or password is incorrect.',
  email_not_confirmed: 'Confirm your email first. Check your inbox for the link.',
  over_request_rate_limit: 'Too many attempts. Wait a minute, then try again.',
  over_email_send_rate_limit: 'Too many emails sent. Wait a minute, then try again.',
  mfa_verification_failed: "That code didn't work. Check your authenticator app and try again.",
  mfa_challenge_expired: 'That code expired. Enter the newest code from your app.',
  weak_password: 'Choose a stronger password that meets every rule below.',
  same_password: 'Choose a password you have not used before.',
};

// Postgres error codes our own database functions raise with human-readable messages.
const OUR_DATABASE_CODES = new Set(['22023', '23505', '42501', '54000', '55000', 'P0002']);

/** Turns any auth, database or network error into one plain sentence for the user. */
export function friendlyError(error: unknown): string {
  if (error instanceof TypeError) {
    return "Can't reach the server. Check your connection and try again.";
  }
  if (!error || typeof error !== 'object') return GENERIC;

  const { code, message } = error as { code?: unknown; message?: unknown };
  if (typeof code === 'string') {
    const known = AUTH_MESSAGES[code];
    if (known) return known;
    if (OUR_DATABASE_CODES.has(code) && typeof message === 'string' && message) return message;
  }
  return GENERIC;
}
