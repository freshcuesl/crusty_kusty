import type { DataProvider } from 'react-admin';

const notConnected = () =>
  Promise.reject(new Error('The admin panel is not connected to Supabase yet.'));

/**
 * Placeholder until the auth branch wires up ra-supabase. Every call fails
 * loudly so nothing can silently pretend to save moderation decisions.
 */
export const dataProvider: DataProvider = {
  getList: notConnected,
  getOne: notConnected,
  getMany: notConnected,
  getManyReference: notConnected,
  create: notConnected,
  update: notConnected,
  updateMany: notConnected,
  delete: notConnected,
  deleteMany: notConnected,
};
