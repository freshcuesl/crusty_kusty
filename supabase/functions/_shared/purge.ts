// Deletes evidence files of expired records from Storage. The nightly database
// job (private.purge_expired) queues the files; files can only be removed
// through the Storage API, so this function empties the queue. Pure TypeScript
// with injected dependencies, so it runs in Deno and in Vitest.

export interface QueuedFile {
  id: number;
  bucket: string;
  path: string;
}

export interface PurgeDeps {
  /** Shared secret that pg_cron sends in the x-purge-secret header. */
  secret: string;
  claim(limit: number): Promise<QueuedFile[]>;
  remove(bucket: string, paths: string[]): Promise<void>;
  confirm(ids: number[]): Promise<void>;
}

const BATCH = 100;
const MAX_ROUNDS = 20;

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Constant-time comparison, so response timing reveals nothing about the secret. */
export function sameSecret(given: string, expected: string): boolean {
  if (!given || !expected) return false;
  const a = new TextEncoder().encode(given);
  const b = new TextEncoder().encode(expected);
  let diff = a.length ^ b.length;
  for (let i = 0; i < b.length; i++) diff |= (a[i] ?? 0) ^ b[i]!;
  return diff === 0;
}

export async function handlePurgeFiles(req: Request, deps: PurgeDeps): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  if (!sameSecret(req.headers.get('x-purge-secret') ?? '', deps.secret)) {
    return json({ error: 'Not allowed.' }, 401);
  }

  let deleted = 0;
  let failed = 0;
  try {
    for (let round = 0; round < MAX_ROUNDS; round++) {
      const files = await deps.claim(BATCH);
      if (files.length === 0) break;

      const byBucket = new Map<string, QueuedFile[]>();
      for (const file of files) {
        byBucket.set(file.bucket, [...(byBucket.get(file.bucket) ?? []), file]);
      }

      const done: number[] = [];
      for (const [bucket, group] of byBucket) {
        try {
          await deps.remove(
            bucket,
            group.map((f) => f.path),
          );
          done.push(...group.map((f) => f.id));
        } catch {
          // Claimed files are offered again after an hour.
          failed += group.length;
        }
      }
      if (done.length > 0) await deps.confirm(done);
      deleted += done.length;
    }
  } catch {
    return json({ error: 'Cleanup failed. It will retry on the next run.' }, 500);
  }
  return json({ deleted, failed }, 200);
}
