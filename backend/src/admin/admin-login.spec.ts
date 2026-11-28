import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthController } from '../auth/auth.controller.js';

const originalEmail = process.env.ADMIN_LOGIN_EMAIL;
const originalEnvironment = process.env.NODE_ENV;
afterEach(() => {
  if (originalEmail === undefined) delete process.env.ADMIN_LOGIN_EMAIL; else process.env.ADMIN_LOGIN_EMAIL = originalEmail;
  if (originalEnvironment === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = originalEnvironment;
});
const request = {is:()=>true,get:(name:string)=>name === 'origin' ? 'http://localhost:3000' : undefined,socket:{remoteAddress:'127.0.0.1'}};
const response = {cookie:vi.fn(),setHeader:vi.fn()};

describe('admin username sign-in', () => {
  it('maps admin to the configured account and issues a session only for an administrator', async () => {
    process.env.ADMIN_LOGIN_EMAIL = 'owner@example.test'; process.env.NODE_ENV = 'production';
    const auth = {login:vi.fn().mockResolvedValue({user:{id:'123'}}),validateUser:vi.fn().mockResolvedValue({role:'admin',emailVerified:true})};
    const sessions = {issue:vi.fn().mockResolvedValue({refresh_token:'token',access_token:'access',user:{id:'123'}})};
    const controller = new AuthController(auth as never, {} as never, sessions as never, {} as never, {} as never);
    const result = await controller.sessionAdminLogin({username:'admin',password:'temporary'}, request as never, response as never);
    expect(auth.login).toHaveBeenCalledWith({email:'owner@example.test',password:'temporary'});
    expect(sessions.issue).toHaveBeenCalledOnce(); expect(result.access_token).toBe('access');
  });
  it('does not issue an administrator session for an ordinary account', async () => {
    process.env.ADMIN_LOGIN_EMAIL = 'member@example.test'; process.env.NODE_ENV = 'production';
    const auth = {login:vi.fn().mockResolvedValue({user:{id:'123'}}),validateUser:vi.fn().mockResolvedValue({role:'user'})};
    const sessions = {issue:vi.fn()};
    const controller = new AuthController(auth as never, {} as never, sessions as never, {} as never, {} as never);
    await expect(controller.sessionAdminLogin({username:'admin',password:'temporary'}, request as never, response as never)).rejects.toThrow();
    expect(sessions.issue).not.toHaveBeenCalled();
  });
  it('does not issue an administrator session for an unverified account', async () => {
    process.env.ADMIN_LOGIN_EMAIL = 'owner@example.test'; process.env.NODE_ENV = 'production';
    const auth = {login:vi.fn().mockResolvedValue({user:{id:'123'}}),validateUser:vi.fn().mockResolvedValue({role:'admin',emailVerified:false})};
    const sessions = {issue:vi.fn()};
    const controller = new AuthController(auth as never, {} as never, sessions as never, {} as never, {} as never);
    await expect(controller.sessionAdminLogin({username:'admin',password:'temporary'}, request as never, response as never)).rejects.toThrow();
    expect(sessions.issue).not.toHaveBeenCalled();
  });
});
