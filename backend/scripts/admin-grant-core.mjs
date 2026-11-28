import { createHmac } from 'node:crypto';
import bcrypt from 'bcryptjs';

export async function grantVerifiedAdmin(connection, {email, password, secret, apply, hotDays, months}) {
  const db = connection.db;
  const users = db.collection('users');
  const user = await users.findOne({email, emailVerified:true, isActive:true, deletedAt:null}, {projection:{_id:1,role:1,passwordHash:1}});
  if (!user) throw new Error('No active, verified account matches. Register and verify it before granting access.');
  if (typeof user.passwordHash !== 'string' || !await bcrypt.compare(password,user.passwordHash)) throw new Error('The existing account password did not match; no changes were made.');
  if (user.role === 'admin') return 'already-admin';
  if (!apply) return 'dry-run';
  const session = await connection.startSession();
  try {
    await session.withTransaction(async () => {
      const lifecycle = await db.collection('account_lifecycle').updateOne({_id:user._id,status:'active'}, {$inc:{writeVersion:1}}, {session});
      if (!lifecycle.matchedCount) throw new Error('Account lifecycle is not active.');
      const result = await users.updateOne({_id:user._id,email,emailVerified:true,isActive:true,deletedAt:null,role:{$ne:'admin'},passwordHash:user.passwordHash}, {$set:{role:'admin'},$inc:{sessionVersion:1}}, {session});
      if (!result.modifiedCount) throw new Error('Account changed concurrently; no access was granted.');
      const now = new Date(), purgeAt = new Date(now); purgeAt.setUTCMonth(purgeAt.getUTCMonth()+months);
      const targetId = `subject:${createHmac('sha256',secret).update(String(user._id)).digest('hex')}`;
      await db.collection('audit_logs').insertOne({action:'admin_role_granted_by_operator',targetId,occurredAt:now,hotUntil:new Date(now.getTime()+hotDays*86400_000),purgeAt,cold:false,status:200},{session});
    }, {writeConcern:{w:'majority'}});
  } finally { await session.endSession(); }
  return 'granted';
}
