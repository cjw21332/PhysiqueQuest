import assert from 'node:assert/strict';
import test from 'node:test';
import { createDeviceCache } from '../lib/deviceCache.mjs';

function fixture() {
  const values = new Map();
  let context = { scope: 'api:user-a', session: 'session-a' };
  let now = new Date('2026-10-19T12:00:00Z').getTime();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  const options = { context: () => context, storage: () => storage, now: () => now };
  return { cache: createDeviceCache(options), values, options, setContext: value => { context = value; }, advance: milliseconds => { now += milliseconds; } };
}

test('restores successful responses across app restarts, scoped to user and API', async () => {
  const f = fixture();
  await f.cache.fetch('coach', async () => ({ days: [1, 2] }));
  assert.deepEqual(createDeviceCache(f.options).get('coach').data, { days: [1, 2] });
  f.setContext({ scope: 'api:user-b', session: 'session-b' });
  assert.equal(f.cache.get('coach').data, undefined);
  f.setContext({ scope: 'other-api:user-a', session: 'session-a' });
  assert.equal(f.cache.get('coach').data, undefined);
  assert.ok([...f.values.values()].every(value => !value.includes('session-a')));
});

test('deduplicates reads and keeps cached data when refresh fails', async () => {
  const f = fixture();
  f.cache.publish('nutrition', { meals: ['saved'] });
  let resolve;
  let calls = 0;
  const load = () => { calls++; return new Promise(done => { resolve = done; }); };
  const first = f.cache.fetch('nutrition', load, true);
  const second = f.cache.fetch('nutrition', load, true);
  await Promise.resolve();
  assert.equal(calls, 1);
  assert.deepEqual(f.cache.get('nutrition').data, { meals: ['saved'] });
  resolve({ meals: ['fresh'] });
  await Promise.all([first, second]);
  await assert.rejects(f.cache.fetch('nutrition', async () => { throw Error('Offline'); }, true));
  assert.deepEqual(f.cache.get('nutrition').data, { meals: ['fresh'] });
  assert.equal(f.cache.get('nutrition').error, 'Offline');
});

test('an old read cannot overwrite a confirmed write or resurrect an invalidated plan', async () => {
  const f = fixture();
  let resolve;
  const reading = f.cache.fetch('nutrition', () => new Promise(done => { resolve = done; }));
  await Promise.resolve();
  f.cache.publish('nutrition', { water: 3 });
  resolve({ water: 1 });
  await reading;
  assert.equal(f.cache.get('nutrition').data.water, 3);
  const plan = f.cache.fetch('coach', () => new Promise(done => { resolve = done; }));
  await Promise.resolve();
  f.cache.invalidate('coach');
  resolve({ days: ['old'] });
  await plan;
  assert.equal(f.cache.get('coach').data, undefined);
});

test('logout and account switches ignore late responses and errors', async () => {
  const f = fixture();
  let resolve;
  const reading = f.cache.fetch('profile', () => new Promise(done => { resolve = done; }));
  await Promise.resolve();
  f.setContext(null);
  resolve({ name: 'Private name' });
  await reading;
  assert.equal(f.values.size, 0);
  assert.equal(f.cache.get('profile').data, undefined);
});

test('expires old snapshots, rolls over daily missions, and ignores damaged storage', () => {
  const f = fixture();
  f.cache.publish('activity', { dailyMissions: ['yesterday'] });
  f.cache.publish('coach', { days: [1] });
  f.advance(24 * 60 * 60 * 1000);
  assert.equal(f.cache.get('activity').data, undefined);
  assert.deepEqual(f.cache.get('coach').data, { days: [1] });
  f.advance(7 * 24 * 60 * 60 * 1000);
  assert.equal(f.cache.get('coach').data, undefined);
  for (const key of f.values.keys()) f.values.set(key, '{broken');
  assert.equal(createDeviceCache(f.options).get('coach').data, undefined);
});

test('storage failures and oversized records never break successful API responses', async () => {
  const cache = createDeviceCache({ context: () => ({ scope: 'a', session: 'a' }), storage: () => { throw Error('Unavailable'); } });
  const result = await cache.fetch('profile', async () => ({ name: 'Ana' }));
  assert.equal(result.name, 'Ana');
  assert.equal(cache.get('profile').data.name, 'Ana');
  const f = fixture();
  await f.cache.fetch('nutrition', async () => ({ meals: 'x'.repeat(600_000) }));
  assert.equal(f.values.size, 0);
  assert.ok(f.cache.get('nutrition').data);
  assert.throws(() => f.cache.publish('password', { secret: 'no' }));
});

test('parallel resources resolve independently and notify subscribers', async () => {
  const f = fixture();
  let finishCoach;
  let updates = 0;
  f.cache.subscribe(() => updates++);
  const coach = f.cache.fetch('coach', () => new Promise(resolve => { finishCoach = resolve; }));
  await f.cache.fetch('profile', async () => ({ name: 'Ana' }));
  assert.equal(f.cache.get('profile').data.name, 'Ana');
  assert.equal(f.cache.get('coach').refreshing, true);
  finishCoach({ days: [] });
  await coach;
  assert.ok(updates >= 4);
});

test('rejects valid JSON with an invalid resource shape and does not reuse old sessions', async () => {
  const f = fixture();
  f.cache.publish('profile', { name: 'Ana' });
  const cache = createDeviceCache({ ...f.options, validate: (_key, data) => typeof data.name === 'string' });
  assert.equal(cache.get('profile').data.name, 'Ana');
  await assert.rejects(cache.fetch('profile', async () => ({ unexpected: true }), true), /incomplete data/);
  assert.equal(cache.get('profile').data.name, 'Ana');
  let finish;
  const pending = cache.fetch('profile', () => new Promise(resolve => { finish = resolve; }), true);
  await Promise.resolve();
  f.setContext({ scope: 'api:user-a', session: 'new-session' });
  finish({ name: 'Old response' });
  await pending;
  assert.equal(cache.get('profile').data.name, 'Ana');
});

test('expiry clears yesterday\'s failed refresh so today\'s quests can load', async () => {
  const f = fixture();
  f.cache.publish('activity', { dailyMissions: ['old'] });
  await assert.rejects(f.cache.fetch('activity', async () => { throw Error('Offline'); }, true));
  f.advance(24 * 60 * 60 * 1000);
  assert.equal(f.cache.get('activity').data, undefined);
  assert.equal(f.cache.get('activity').error, '');
  await f.cache.fetch('activity', async () => ({ dailyMissions: ['today'] }));
  assert.deepEqual(f.cache.get('activity').data.dailyMissions, ['today']);
});

test('reuses recently confirmed data, refreshes when stale, and respects invalidation', async () => {
  const f = fixture();
  let calls = 0;
  const load = async () => [{ id: ++calls }];
  assert.deepEqual(await f.cache.fetch('progress:weight', load), [{ id: 1 }]);
  assert.deepEqual(await f.cache.fetch('progress:weight', load), [{ id: 1 }]);
  f.advance(60_001);
  assert.deepEqual(await f.cache.fetch('progress:weight', load), [{ id: 2 }]);
  f.cache.invalidate('progress:weight');
  assert.deepEqual(await f.cache.fetch('progress:weight', load), [{ id: 3 }]);
  assert.equal(createDeviceCache(f.options).get('progress:weight').data[0].id, 3);
  f.setContext({ scope: 'api:user-b', session: 'session-b' });
  assert.equal(f.cache.get('progress:weight').data, undefined);
});

test('exercise library snapshots are scoped to the signed-in account', () => {
  const f = fixture();
  f.cache.publish('exercise-library', { query: 'default', result: { items: [{ name: 'Squat' }] } });
  assert.equal(createDeviceCache(f.options).get('exercise-library').data.result.items[0].name, 'Squat');
  f.setContext({ scope: 'api:user-b', session: 'session-b' });
  assert.equal(f.cache.get('exercise-library').data, undefined);
});
