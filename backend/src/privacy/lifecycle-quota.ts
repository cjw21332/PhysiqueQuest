import { Types, type Connection } from 'mongoose';
import { AccountLifecycleFence } from './account-lifecycle-fence.js';

/** Both buckets commit together; only the user bucket is account-owned. */
export async function consumeQuota(connection: Connection, userId: string, buckets: { id: string; owned: boolean; expiresAt: Date }[], expectedGeneration?: number) {
  // Runtime fail-closed check: a type-level requirement does not stop a
  // runtime undefined from bypassing the fence (undefined means "any active
  // generation" inside withActiveWrite).
  if (expectedGeneration === undefined || !Number.isSafeInteger(expectedGeneration) || expectedGeneration < 0) {
    throw new Error('Quota requires an authenticated lifecycle generation.');
  }
  const fence = new AccountLifecycleFence(connection);
  return fence.withActiveWrite(userId, async session => {
    const counts: number[] = [];
    for (const bucket of buckets) {
      const row = await connection.db!.collection<{ _id: string; hits: number }>('auth_rate_limits').findOneAndUpdate(
        { _id: bucket.id },
        { $inc: { hits: 1 }, $setOnInsert: { expiresAt: bucket.expiresAt, ...(bucket.owned ? { userId: new Types.ObjectId(userId), generation: expectedGeneration } : {}) } },
        { upsert: true, returnDocument: 'after', session },
      );
      if (!row || !Number.isInteger(row.hits)) throw new Error('Invalid quota record');
      counts.push(row.hits);
    }
    return counts;
  }, expectedGeneration);
}
