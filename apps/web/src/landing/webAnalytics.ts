export const BEACON_ID = 'cf-web-analytics';

/**
 * Cloudflare Web Analytics: cookie-free visitor counts for the public landing page.
 * `spa: false` records only the page load, so nothing inside the app is tracked
 * after a visitor signs in.
 */
export function loadWebAnalytics(token: string | undefined): void {
  if (!token || document.getElementById(BEACON_ID)) return;
  const script = document.createElement('script');
  script.id = BEACON_ID;
  script.defer = true;
  script.src = 'https://static.cloudflareinsights.com/beacon.min.js';
  script.dataset.cfBeacon = JSON.stringify({ token, spa: false });
  document.head.appendChild(script);
}
