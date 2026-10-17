import '@fontsource/plus-jakarta-sans/latin-700.css';
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import * as Sentry from '@sentry/react';
import { CrashScreen } from '@cs/brand';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { monitoringOptions } from '@cs/core';
import { App } from './App';

// Error tracking is on only when VITE_SENTRY_DSN is set (hosted builds). Reports are
// scrubbed of names, emails, phone numbers and query strings before they leave.
const monitoring = monitoringOptions(import.meta.env);
if (monitoring) Sentry.init(monitoring);

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element in index.html');

createRoot(root).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={<CrashScreen />}>
      <App />
    </Sentry.ErrorBoundary>
  </StrictMode>,
);
