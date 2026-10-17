import { describe, expect, it, vi } from 'vitest';
import { handlePurgeFiles, sameSecret, type PurgeDeps, type QueuedFile } from './purge.ts';

const SECRET = 'a-long-random-secret-value';

function setup(batches: QueuedFile[][], overrides: Partial<PurgeDeps> = {}) {
  const queue = [...batches];
  const deps: PurgeDeps = {
    secret: SECRET,
    claim: vi.fn(async () => queue.shift() ?? []),
    remove: vi.fn(async () => {}),
    confirm: vi.fn(async () => {}),
    ...overrides,
  };
  return deps;
}

function request(secret: string | null = SECRET, method = 'POST') {
  const headers = new Headers();
  if (secret !== null) headers.set('x-purge-secret', secret);
  return new Request('https://example.test/functions/v1/purge-expired-files', { method, headers });
}

describe('handlePurgeFiles', () => {
  it('refuses callers without the shared secret', async () => {
    const deps = setup([]);
    expect((await handlePurgeFiles(request(null), deps)).status).toBe(401);
    expect((await handlePurgeFiles(request('wrong'), deps)).status).toBe(401);
    expect(deps.claim).not.toHaveBeenCalled();
  });

  it('only accepts POST', async () => {
    const res = await handlePurgeFiles(request(SECRET, 'GET'), setup([]));
    expect(res.status).toBe(405);
  });

  it('deletes queued files bucket by bucket and confirms them', async () => {
    const deps = setup([
      [
        { id: 1, bucket: 'incident-evidence', path: 'b/i/a.pdf' },
        { id: 2, bucket: 'incident-evidence', path: 'b/i/b.jpg' },
        { id: 3, bucket: 'business-documents', path: 'b/c.pdf' },
      ],
    ]);
    const res = await handlePurgeFiles(request(), deps);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ deleted: 3, failed: 0 });
    expect(deps.remove).toHaveBeenCalledWith('incident-evidence', ['b/i/a.pdf', 'b/i/b.jpg']);
    expect(deps.remove).toHaveBeenCalledWith('business-documents', ['b/c.pdf']);
    expect(deps.confirm).toHaveBeenCalledWith([1, 2, 3]);
  });

  it('keeps going until the queue is empty', async () => {
    const deps = setup([
      [{ id: 1, bucket: 'incident-evidence', path: 'a' }],
      [{ id: 2, bucket: 'incident-evidence', path: 'b' }],
    ]);
    const res = await handlePurgeFiles(request(), deps);
    expect(await res.json()).toEqual({ deleted: 2, failed: 0 });
    expect(deps.claim).toHaveBeenCalledTimes(3);
  });

  it('leaves files in the queue when storage refuses, so the next run retries', async () => {
    const deps = setup(
      [
        [
          { id: 1, bucket: 'incident-evidence', path: 'a' },
          { id: 2, bucket: 'business-documents', path: 'b' },
        ],
      ],
      {
        remove: vi.fn(async (bucket: string) => {
          if (bucket === 'incident-evidence') throw new Error('storage down');
        }),
      },
    );
    const res = await handlePurgeFiles(request(), deps);
    expect(await res.json()).toEqual({ deleted: 1, failed: 1 });
    expect(deps.confirm).toHaveBeenCalledWith([2]);
  });

  it('reports a server error without details when the queue cannot be read', async () => {
    const deps = setup([], { claim: vi.fn(async () => Promise.reject(new Error('db secret'))) });
    const res = await handlePurgeFiles(request(), deps);
    expect(res.status).toBe(500);
    expect(await res.text()).not.toMatch(/db secret/);
  });

  it('stops after a safe number of rounds', async () => {
    const deps = setup([], {
      claim: vi.fn(async () => [{ id: 1, bucket: 'incident-evidence', path: 'a' }]),
    });
    await handlePurgeFiles(request(), deps);
    expect(deps.claim).toHaveBeenCalledTimes(20);
  });
});

describe('sameSecret', () => {
  it('compares secrets without short-circuiting on length', () => {
    expect(sameSecret('abc', 'abc')).toBe(true);
    expect(sameSecret('abc', 'abd')).toBe(false);
    expect(sameSecret('abc', 'abcd')).toBe(false);
    expect(sameSecret('', '')).toBe(false);
  });
});
