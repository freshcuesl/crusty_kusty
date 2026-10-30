/** Anything that can report an error, such as the Sentry SDK once it has loaded. */
export interface ErrorSink {
  captureException(error: unknown): unknown;
}

/**
 * Reports errors through a sink that loads in the background. Errors that happen
 * before it arrives are kept (up to 20) and sent once it does; with no sink (error
 * tracking off) reporting does nothing and nothing is downloaded.
 */
export function createErrorReporter(load: (() => Promise<ErrorSink>) | null) {
  const pending: unknown[] = [];
  let sink: ErrorSink | null = null;
  const ready = load
    ? load().then(
        (loaded) => {
          sink = loaded;
          pending.splice(0).forEach((error) => loaded.captureException(error));
        },
        () => {
          pending.length = 0;
        },
      )
    : Promise.resolve();

  return {
    ready,
    report(error: unknown) {
      if (sink) sink.captureException(error);
      else if (load && pending.length < 20) pending.push(error);
    },
  };
}
