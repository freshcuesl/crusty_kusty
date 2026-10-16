import type { SupabaseClient } from '@supabase/supabase-js';
import type { DataProvider, GetListParams, RaRecord } from 'react-admin';

const readOnly = () =>
  Promise.reject(
    new Error('Records are read-only here. Use the review actions to make decisions.'),
  );

/**
 * Read-only react-admin data provider over Supabase. Row-level security decides
 * what a moderator may see; every change goes through a checked database
 * function (for example review_business), never a direct table write.
 */
export function createDataProvider(supabase: SupabaseClient): DataProvider {
  async function list(resource: string, params: GetListParams) {
    const { page, perPage } = params.pagination ?? { page: 1, perPage: 25 };
    let query = supabase.from(resource).select('*', { count: 'exact' });
    for (const [field, value] of Object.entries(params.filter ?? {})) {
      if (value !== '' && value !== undefined && value !== null) query = query.eq(field, value);
    }
    if (params.sort) {
      query = query.order(params.sort.field, { ascending: params.sort.order === 'ASC' });
    }
    const { data, error, count } = await query.range((page - 1) * perPage, page * perPage - 1);
    if (error) throw error;
    return { data: (data ?? []) as RaRecord[], total: count ?? data?.length ?? 0 };
  }

  return {
    getList: (resource, params) => list(resource, params) as never,

    async getOne(resource, { id }) {
      const { data, error } = await supabase.from(resource).select('*').eq('id', id).single();
      if (error) throw error;
      return { data } as never;
    },

    async getMany(resource, { ids }) {
      const { data, error } = await supabase.from(resource).select('*').in('id', ids);
      if (error) throw error;
      return { data: data ?? [] } as never;
    },

    getManyReference: (resource, { target, id, ...params }) =>
      list(resource, { ...params, filter: { ...params.filter, [target]: id } }) as never,

    create: readOnly,
    update: readOnly,
    updateMany: readOnly,
    delete: readOnly,
    deleteMany: readOnly,
  };
}
