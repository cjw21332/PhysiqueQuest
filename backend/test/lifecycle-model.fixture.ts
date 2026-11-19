import { vi } from 'vitest';

/** Unit-only Mongoose adapter. Lifecycle races use real models in e2e tests. */
export function lifecycleModel<T extends object>(model: T, legacyCreate = false): T {
  const value = model as any;
  if (!value.db) {
    const lifecycle = { find: () => ({ async *[Symbol.asyncIterator]() {} }), findOne: vi.fn(async () => ({ status: 'active', generation: 0 })), updateOne: vi.fn(async () => ({ matchedCount: 1 })) };
    value.db = { collection: () => lifecycle, startSession: async () => ({ inTransaction: () => true, withTransaction: async (callback: () => Promise<unknown>) => callback(), endSession: async () => {} }) };
  }
  if (legacyCreate && typeof value.create === 'function') {
    value.create = new Proxy(value.create, { apply(target, receiver, args) {
      if (Array.isArray(args[0])) return Promise.all(args[0].map((row: unknown) => Reflect.apply(target, receiver, [row])));
      return Reflect.apply(target, receiver, args);
    } });
  }
  for (const name of ['findById', 'findOneAndUpdate', 'findByIdAndUpdate', 'findOneAndDelete', 'deleteOne', 'updateOne']) {
    const original = value[name];
    if (typeof original !== 'function') continue;
    value[name] = new Proxy(original, { apply(target, receiver, args) {
      const result = Reflect.apply(target, receiver, args);
      if (result && typeof result === 'object' && !result.session) result.session = () => result;
      return result;
    } });
  }
  return model;
}
