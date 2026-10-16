import { createFakeSupabase } from '@cs/core/testing';
import { describe, expect, it } from 'vitest';
import { createDataProvider } from './dataProvider';

const businesses = [
  { id: 'b1', name: 'Alpha Plumbing', verification_status: 'pending' },
  { id: 'b2', name: 'Bravo Steam', verification_status: 'pending' },
];

function setup() {
  const fake = createFakeSupabase({ tables: { businesses } });
  return { fake, dp: createDataProvider(fake.client) };
}

describe('admin dataProvider', () => {
  it('lists rows with filters, sorting, paging and a total', async () => {
    const { fake, dp } = setup();
    const result = await dp.getList('businesses', {
      pagination: { page: 2, perPage: 10 },
      sort: { field: 'submitted_at', order: 'ASC' },
      filter: { verification_status: 'pending' },
    });

    expect(fake.mocks.from).toHaveBeenCalledWith('businesses');
    expect(fake.query.select).toHaveBeenCalledWith('*', { count: 'exact' });
    expect(fake.query.eq).toHaveBeenCalledWith('verification_status', 'pending');
    expect(fake.query.order).toHaveBeenCalledWith('submitted_at', { ascending: true });
    expect(fake.query.range).toHaveBeenCalledWith(10, 19);
    expect(result).toEqual({ data: businesses, total: 2 });
  });

  it('ignores empty filter values from the filter form', async () => {
    const { fake, dp } = setup();
    await dp.getList('businesses', {
      pagination: { page: 1, perPage: 25 },
      sort: { field: 'id', order: 'DESC' },
      filter: { verification_status: '' },
    });
    expect(fake.query.eq).not.toHaveBeenCalled();
  });

  it('reads one row by id', async () => {
    const { fake, dp } = setup();
    const { data } = await dp.getOne('businesses', { id: 'b1' });
    expect(fake.query.eq).toHaveBeenCalledWith('id', 'b1');
    expect(data).toEqual(businesses[0]);
  });

  it('reads several rows by id', async () => {
    const { fake, dp } = setup();
    await dp.getMany('businesses', { ids: ['b1', 'b2'] });
    expect(fake.query.in).toHaveBeenCalledWith('id', ['b1', 'b2']);
  });

  it('reads related rows, such as a business’s documents', async () => {
    const { fake, dp } = setup();
    await dp.getManyReference('business_documents', {
      target: 'business_id',
      id: 'b1',
      pagination: { page: 1, perPage: 50 },
      sort: { field: 'uploaded_at', order: 'ASC' },
      filter: {},
    });
    expect(fake.mocks.from).toHaveBeenCalledWith('business_documents');
    expect(fake.query.eq).toHaveBeenCalledWith('business_id', 'b1');
  });

  it('passes database errors through to react-admin', async () => {
    const { fake, dp } = setup();
    fake.query.single.mockResolvedValueOnce({
      data: null,
      error: { code: '42501', message: 'permission denied' },
    } as never);
    await expect(dp.getOne('businesses', { id: 'b1' })).rejects.toMatchObject({ code: '42501' });
  });

  it('refuses direct edits: decisions go through the review actions', async () => {
    const { dp } = setup();
    await expect(
      dp.update('businesses', {
        id: 'b1',
        data: { verification_status: 'verified' },
        previousData: {},
      }),
    ).rejects.toThrow(/review actions/);
    await expect(dp.delete('businesses', { id: 'b1' })).rejects.toThrow(/review actions/);
  });
});
