import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Types, type ClientSession, type Connection } from 'mongoose';
import { lifecycleContext } from './lifecycle-context.js';

/**
 * Serializes user-owned persistence with lifecycle transitions. External effects
 * must stay outside the retryable transaction callback.
 */
@Injectable()
export class AccountLifecycleFence {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  private get records() {
    return this.connection.collection('account_lifecycle');
  }

  // The driver may retry this callback. Only transaction-bound database writes
  // belong inside it; never perform provider, storage, or other external calls.
  async generation(userId: string): Promise<number> {
    const record = await this.records.findOne({ _id: new Types.ObjectId(userId), status: 'active' }, { projection: { generation: 1 } });
    if (!record || (record.generation !== undefined && (!Number.isSafeInteger(record.generation) || record.generation < 0))) throw new ForbiddenException('Account data is unavailable.');
    return record.generation ?? 0;
  }

  async withActiveWrite<T>(userId: string, write: (session: ClientSession) => Promise<T>, expectedGeneration?: number): Promise<T> {
    if (expectedGeneration !== undefined && (!Number.isSafeInteger(expectedGeneration) || expectedGeneration < 0)) throw new ForbiddenException('Account data is unavailable.');
    const session = await this.connection.startSession();
    try {
      let value!: T;
      await session.withTransaction(async () => {
        // An actual write, not a snapshot read: competing lifecycle transitions
        // must conflict with a writer even if both started from the same state.
        await this.participate(userId, session, expectedGeneration);
        value = await write(session);
      }, { writeConcern: { w: 'majority' } });
      return value;
    } finally {
      await session.endSession();
    }
  }

  async participate(userId: string, session: ClientSession, expectedGeneration?: number) {
    const request = lifecycleContext.getStore();
    if (request?.userId === userId) {
      if (expectedGeneration !== undefined && expectedGeneration !== request.generation) throw new ForbiddenException('Account data is unavailable.');
      expectedGeneration = request.generation;
    }
    if (!session.inTransaction()) throw new Error('Lifecycle fence requires an active transaction');
    if (expectedGeneration !== undefined && (!Number.isSafeInteger(expectedGeneration) || expectedGeneration < 0)) throw new ForbiddenException('Account data is unavailable.');
    const fence = await this.records.updateOne(
      { _id: new Types.ObjectId(userId), status: 'active', ...(expectedGeneration === undefined ? {} : expectedGeneration === 0 ? { $or: [{ generation: 0 }, { generation: { $exists: false } }] } : { generation: expectedGeneration }) },
      { $inc: { writeVersion: 1 } }, { session },
    );
    if (!fence.matchedCount) throw new ForbiddenException('Account data is unavailable.');
  }

  async beginDeletion(userId: string): Promise<boolean> {
    const result = await this.records.updateOne(
      { _id: new Types.ObjectId(userId), status: 'active' },
      { $set: { status: 'deleting', deletionRequestedAt: new Date() }, $inc: { writeVersion: 1, generation: 1 } },
      { writeConcern: { w: 'majority' } },
    );
    return result.modifiedCount === 1;
  }
}
