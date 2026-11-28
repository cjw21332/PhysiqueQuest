import { describe, expect, it, vi } from 'vitest';
import bcrypt from 'bcryptjs';
import { grantVerifiedAdmin } from '../scripts/admin-grant-core.mjs';

const input = {email:'owner@example.test',password:'Existing123',secret:'a'.repeat(32),apply:false,hotDays:90,months:12};

async function fixture(user: Record<string,unknown> | null) {
  const actual = user ? {...user,passwordHash:await bcrypt.hash('Existing123',4)} : null;
  const users = {findOne:vi.fn().mockResolvedValue(actual),updateOne:vi.fn().mockResolvedValue({modifiedCount:1})};
  const lifecycle = {updateOne:vi.fn().mockResolvedValue({matchedCount:1})};
  const audit = {insertOne:vi.fn().mockResolvedValue({})};
  const session = {withTransaction:vi.fn(async(fn:()=>Promise<void>)=>fn()),endSession:vi.fn()};
  const collection = (name:string) => ({users,account_lifecycle:lifecycle,audit_logs:audit}[name]);
  return {connection:{db:{collection},startSession:vi.fn().mockResolvedValue(session)},users,lifecycle,audit,session};
}
describe('verified administrator provisioning', () => {
  it('rejects missing accounts and incorrect passwords without changes', async () => {
    const missing=await fixture(null);
    await expect(grantVerifiedAdmin(missing.connection,input)).rejects.toThrow('No active, verified account');
    expect(missing.connection.startSession).not.toHaveBeenCalled();
    const existing=await fixture({_id:'123',role:'user'});
    await expect(grantVerifiedAdmin(existing.connection,{...input,password:'wrong'})).rejects.toThrow('password did not match');
    expect(existing.users.updateOne).not.toHaveBeenCalled();
  });
  it('only checks by default and leaves the account unchanged', async () => {
    const f=await fixture({_id:'123',role:'user'});
    await expect(grantVerifiedAdmin(f.connection,input)).resolves.toBe('dry-run');
    expect(f.connection.startSession).not.toHaveBeenCalled();
    expect(f.users.findOne.mock.calls[0][0]).toMatchObject({emailVerified:true,isActive:true,deletedAt:null});
  });
  it('grants only the role, revokes old sessions and writes an audit record atomically', async () => {
    const f=await fixture({_id:'123',role:'user'});
    await expect(grantVerifiedAdmin(f.connection,{...input,apply:true})).resolves.toBe('granted');
    const [filter,update] = f.users.updateOne.mock.calls[0];
    expect(filter).toMatchObject({email:input.email,emailVerified:true,isActive:true});
    expect(update).toEqual({$set:{role:'admin'},$inc:{sessionVersion:1}});
    expect(f.audit.insertOne.mock.calls[0][0]).toMatchObject({action:'admin_role_granted_by_operator'});
    expect(JSON.stringify(f.audit.insertOne.mock.calls)).not.toContain(input.password);
    expect(f.session.endSession).toHaveBeenCalledOnce();
  });
});
