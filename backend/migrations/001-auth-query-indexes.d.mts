import type { Db } from 'mongodb';
export const id: string;
export function up(db: Db): Promise<void>;
export function down(db: Db): Promise<void>;
