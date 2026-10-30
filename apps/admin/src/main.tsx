import '@fontsource/plus-jakarta-sans/latin-700.css';
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import { CrashBoundary, CrashScreen } from '@cs/brand';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createSupabaseClient, createErrorReporter, monitoringOptions } from '@cs/core';
import { AdminApp } from './AdminApp';

// Error tracking is on only when VITE_SENTRY_DSN is set (hosted builds). Reports are
// scrubbed of names, emails, phone numbers and query strings before they leave.
// Sentry downloads in the background, so it never delays the first screen, and not
// at all when tracking is off.
const monitoring = monitoringOptions(import.meta.env);
const errors = createErrorReporter(
  monitoring
    ? () =>
        import('@sentry/react').then((Sentry) => {
          Sentry.init(monitoring);
          return Sentry;
        })
    : null,
);

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element in index.html');

createRoot(root).render(
  <StrictMode>
    <CrashBoundary fallback={<CrashScreen />} onError={(error) => errors.report(error)}>
      <AdminApp supabase={createSupabaseClient(import.meta.env)} />
    </CrashBoundary>
  </StrictMode>,
);
