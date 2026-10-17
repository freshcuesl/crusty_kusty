/**
 * Shown if the app itself crashes. Plain HTML on purpose: it must work even when
 * the theme or the rest of the app is what broke.
 */
export function CrashScreen() {
  return (
    <main style={{ fontFamily: 'Inter, system-ui, sans-serif', padding: 24, maxWidth: 480 }}>
      <h1>Something went wrong</h1>
      <p>We&apos;ve been told about it. Reload the page to keep going.</p>
      <button type="button" onClick={() => window.location.reload()}>
        Reload
      </button>
    </main>
  );
}
