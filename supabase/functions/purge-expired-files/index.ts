// Deletes evidence files of expired records. Called by pg_cron (via pg_net), not by
// users, so JWT checks are off (see config.toml); a shared secret is required instead.
import { getAdmin, requireEnv } from '../_shared/clients.ts';
import { handlePurgeFiles, type QueuedFile } from '../_shared/purge.ts';

Deno.serve((req) =>
  handlePurgeFiles(req, {
    secret: requireEnv('PURGE_FILES_SECRET'),

    async claim(limit) {
      const { data, error } = await getAdmin().rpc('claim_storage_purge', { p_limit: limit });
      if (error) throw error;
      return (data ?? []) as QueuedFile[];
    },

    async remove(bucket, paths) {
      const { error } = await getAdmin().storage.from(bucket).remove(paths);
      if (error) throw error;
    },

    async confirm(ids) {
      const { error } = await getAdmin().rpc('confirm_storage_purge', { p_ids: ids });
      if (error) throw error;
    },
  }),
);
