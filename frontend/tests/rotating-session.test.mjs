import assert from 'node:assert/strict';
import test from 'node:test';
import { createSession } from '../lib/rotatingSession.mjs';

const reply = (token = 'access') => ({ ok: true, status: 200, json: async () => ({ access_token: token, expires_in: 900, user: { id: 'owner', name: 'Owner', email: 'a@example.com' } }) });

test('session subscribers see login, verification refresh and logout', async () => {
  const session = createSession({ fetcher: async () => ({ ok: true, status: 200, json: async () => ({ access_token: 'updated', expires_in: 900, user: { id: 'owner', emailVerified: true } }) }) });
  const changes = [];
  const unsubscribe = session.subscribe(() => changes.push(session.current()?.emailVerified ?? null));
  session.set({ access_token: 'initial', expires_in: 900, user: { id: 'owner', emailVerified: false } }, '/api');
  await session.refresh('/api');
  session.clear();
  unsubscribe();
  session.set({ access_token: 'next', expires_in: 900, user: { id: 'owner', emailVerified: true } }, '/api');
  assert.deepEqual(changes, [false, true, null]);
});

test('migrates legacy storage once, deletes stored tokens immediately and keeps access only in memory', async () => {
  const storage = new Map([['physiquequest-auth', JSON.stringify({ token: 'legacy' })]]);
  const calls = [];
  const session = createSession({ fetcher: async (...args) => { calls.push(args); assert.equal(storage.size, 0); return reply(); }, storage: () => ({ getItem: key => storage.get(key), removeItem: key => storage.delete(key) }) });
  await session.restore('/api');
  assert.equal(session.current().token, 'access');
  assert.equal(calls[0][0], '/api/auth/session/migrate');
  assert.equal(calls[0][1].headers.Authorization, 'Bearer legacy');
  assert.equal(storage.size, 0);
});

test('deduplicates simultaneous silent refreshes and includes credentials', async () => {
  let calls = 0;
  const session = createSession({ fetcher: async (_url, init) => { calls++; assert.equal(init.credentials, 'include'); return reply(); } });
  await Promise.all([session.refresh('/api'), session.refresh('/api')]);
  assert.equal(calls, 1);
  assert.equal(session.current().token, 'access');
});

test('retries an interrupted legacy migration using memory, without restoring the localStorage token', async () => {
  let calls = 0, stored = JSON.stringify({ token: 'legacy' });
  const session = createSession({ storage: () => ({ getItem: () => stored, removeItem: () => { stored = null; } }), fetcher: async (url, init) => {
    assert.equal(stored, null); assert.ok(url.endsWith('/migrate')); assert.equal(init.headers.Authorization, 'Bearer legacy');
    if (++calls === 1) throw Error('Network lost');
    return reply();
  } });
  await assert.rejects(session.restore('/api'), /Network lost/);
  await session.restore('/api');
  assert.equal(calls, 2); assert.equal(session.current().token, 'access'); assert.equal(stored, null);
});

test('logout cannot be undone by a late refresh response', async () => {
  let done;
  const session = createSession({ fetcher: () => new Promise(resolve => { done = resolve; }) });
  const pending = session.refresh('/api');
  session.clear(); done(reply()); await pending;
  assert.equal(session.current(), null);
});

test('rotation preserves session identity while a new login changes it', async () => {
  const session = createSession({ fetcher: async () => reply('rotated') });
  const first = session.set(await reply('original').json(), '/api');
  await session.refresh('/api'); assert.equal(session.current().sessionKey, first.sessionKey);
  session.set(await reply('new-login').json(), '/api'); assert.notEqual(session.current().sessionKey, first.sessionKey);
});

test('does not forward a retained legacy credential to a different API', async () => {
  let stored = JSON.stringify({ token: 'legacy' }); const calls = [];
  const session = createSession({ storage: () => ({ getItem: () => stored, removeItem: () => { stored = null; } }), fetcher: async (url, init) => {
    calls.push([url, init]); if (calls.length === 1) throw Error('Offline'); return { status: 401, ok: false };
  } });
  await assert.rejects(session.restore('https://first.example/api'));
  await session.restore('https://second.example/api');
  assert.equal(calls[1][0], 'https://second.example/api/auth/session/refresh');
  assert.equal(calls[1][1].headers.Authorization, undefined);
});

test('rejects refresh credentials in JSON and clears invalid sessions', async () => {
  const session = createSession({ fetcher: async () => ({ ...reply(), json: async () => ({ ...(await reply().json()), refresh_token: 'must-never-be-in-js' }) }) });
  await assert.rejects(session.refresh('/api'), /session response/i);
  assert.equal(session.current(), null);
});
