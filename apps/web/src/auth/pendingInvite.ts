// An invite link opened before sign-up is remembered for this browser tab only.
const KEY = 'cs.pendingInvite';

export function savePendingInvite(token: string) {
  try {
    sessionStorage.setItem(KEY, token);
  } catch {
    // Storage blocked: the user can open the invite link again after signing in.
  }
}

export function readPendingInvite(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function clearPendingInvite() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}
