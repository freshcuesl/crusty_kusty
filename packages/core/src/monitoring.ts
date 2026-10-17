// Error tracking (Sentry) settings. Reports are for fixing bugs, so they must
// never carry customer or account details: everything goes through scrubEvent.

/** The parts of a Sentry event we touch. Structural, so core needs no Sentry dependency. */
export interface ScrubbableEvent {
  message?: string;
  user?: unknown;
  request?: {
    url?: string;
    query_string?: unknown;
    cookies?: unknown;
    headers?: unknown;
    data?: unknown;
  };
  exception?: { values?: { type?: string; value?: string }[] };
  breadcrumbs?: Breadcrumb[];
}

export interface Breadcrumb {
  category?: string;
  message?: string;
  data?: Record<string, unknown>;
}

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
// US numbers in common shapes: (206) 555-0100, 206.555.0100, +1 206 555 0100, 2065550100.
const PHONE = /(?:\+?1[\s.-]?)?(?:\(\d{3}\)|\b\d{3})[\s.-]?\d{3}[\s.-]?\d{4}\b/g;

export function maskPersonalData(text: string): string {
  return text.replace(EMAIL, '[email]').replace(PHONE, '[phone]');
}

function withoutQuery(url: unknown): unknown {
  return typeof url === 'string' ? url.replace(/[?#].*$/, '') : url;
}

export function scrubBreadcrumb<B extends Breadcrumb>(crumb: B): B | null {
  // Console output can contain anything; it isn't needed to fix crashes.
  if (crumb.category === 'console') return null;
  const data = crumb.data ? { ...crumb.data } : undefined;
  if (data) {
    for (const key of ['url', 'from', 'to']) {
      if (key in data) data[key] = withoutQuery(data[key]);
    }
  }
  return {
    ...crumb,
    ...(crumb.message ? { message: maskPersonalData(crumb.message) } : {}),
    ...(data ? { data } : {}),
  };
}

export function scrubEvent<E extends ScrubbableEvent>(event: E): E {
  const scrubbed: E = { ...event };
  delete scrubbed.user;
  if (event.request) {
    scrubbed.request = event.request.url ? { url: withoutQuery(event.request.url) as string } : {};
  }
  if (event.message) scrubbed.message = maskPersonalData(event.message);
  if (event.exception?.values) {
    scrubbed.exception = {
      ...event.exception,
      values: event.exception.values.map((v) => ({
        ...v,
        ...(v.value ? { value: maskPersonalData(v.value) } : {}),
      })),
    };
  }
  if (event.breadcrumbs) {
    scrubbed.breadcrumbs = event.breadcrumbs
      .map((crumb) => scrubBreadcrumb(crumb))
      .filter((crumb): crumb is Breadcrumb => crumb !== null);
  }
  return scrubbed;
}

interface MonitoringEnv {
  VITE_SENTRY_DSN?: string;
  VITE_RELEASE?: string;
  MODE?: string;
}

/** Sentry.init options, or null when error tracking is off (no DSN, e.g. local dev). */
export function monitoringOptions(env: MonitoringEnv) {
  const dsn = env.VITE_SENTRY_DSN?.trim();
  if (!dsn) return null;
  return {
    dsn,
    release: env.VITE_RELEASE || undefined,
    environment: env.MODE ?? 'production',
    sendDefaultPii: false,
    tracesSampleRate: 0,
    beforeSend: scrubEvent,
    beforeBreadcrumb: scrubBreadcrumb,
  };
}
