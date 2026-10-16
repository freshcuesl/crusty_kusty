/** Leaves the app for an external page (Stripe). A module so tests can intercept it. */
export function redirectTo(url: string): void {
  window.location.assign(url);
}
