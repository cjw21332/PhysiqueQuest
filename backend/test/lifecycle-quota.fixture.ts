import { vi } from 'vitest';
export function quotaModel(store?: { findOneAndUpdate: (...args: any[]) => any }) {
  const counts = new Map<string, number>();
  const collection = store ?? { findOneAndUpdate: vi.fn(async (filter: any) => { const hits = (counts.get(filter._id) ?? 0) + 1; counts.set(filter._id, hits); return { hits }; }) };
  const lifecycle = { findOne: async () => ({ generation: 0 }), updateOne: async () => ({ matchedCount: 1 }) };
  return { ...collection, db: { db: { collection: () => collection }, collection: () => lifecycle, startSession: async () => ({ inTransaction: () => true, withTransaction: async (fn: () => Promise<unknown>) => fn(), endSession: async () => {} }) } };
}
