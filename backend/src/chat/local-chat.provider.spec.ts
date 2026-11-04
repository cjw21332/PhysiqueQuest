import { afterEach, describe, expect, it, vi } from 'vitest';
import { LocalChatProvider } from './local-chat.provider.js';
import { chatConfig, isPrivateChatAddress } from './chat-config.js';
import { createServer } from 'node:http';
const { dnsLookup } = vi.hoisted(() => ({ dnsLookup: vi.fn() }));
vi.mock('node:dns/promises', () => ({ lookup: dnsLookup }));
const local = { details: { family: 'qwen35' }, model_info: { architecture: 'qwen35' }, capabilities: ['completion'] };
const generated = (reply: unknown = { inScope: true, answer: 'Home shows saved activity.', sourceIds: ['system-home'] }) => ({
  done: true, done_reason: 'stop', message: { role: 'assistant', content: JSON.stringify(reply) },
});
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const provider = (env: Record<string, string> = {}) => new LocalChatProvider({ get: (name: string) => env[name] } as never);
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers(); dnsLookup.mockReset(); });
describe('local-only inference boundary', () => {
  it('resolves meaning with a closed schema and no records, tools or assistant-role messages', async () => {
    const plan = { decision: 'answer', routeIds: ['nutrition.calorie-target'], timeframe: 'unspecified' };
    const fetch = vi.fn().mockResolvedValueOnce(json(local)).mockResolvedValueOnce(json(generated({ routeIds: plan.routeIds, timeframe: plan.timeframe })));
    vi.stubGlobal('fetch', fetch);
    expect(await provider().routeQuestion('What is my energy allowance?', ['Which eating blueprint did I choose?'], '/scan')).toEqual(plan);
    const body = JSON.parse(fetch.mock.calls[1][1].body);
    expect(body).not.toHaveProperty('tools');
    expect(body.format.additionalProperties).toBe(false);
    expect(body.format.properties.routeIds.items.enum).toContain('nutrition.calorie-target');
    expect(body.messages.every((message: { role: string }) => message.role !== 'assistant')).toBe(true);
    expect(JSON.parse(body.messages[1].content)).not.toHaveProperty('sources');
    expect(body.options.temperature).toBe(0);
  });
  it.each([
    { routeIds: ['foreign-database-query'], timeframe: 'today' },
    { routeIds: ['nutrition.plan'], timeframe: 'today', userId: 'forged' },
    { routeIds: [], timeframe: 'today' },
    { routeIds: ['clarify', 'nutrition.plan'], timeframe: 'today' },
    { routeIds: ['nutrition.plan', 'nutrition.plan'], timeframe: 'today' },
    { routeIds: ['nutrition.plan'], timeframe: 'invented-database-query' },
  ])('rejects an invalid semantic plan %j', async plan => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(json(local)).mockResolvedValueOnce(json(generated(plan))));
    await expect(provider().routeQuestion('Unfamiliar question')).rejects.toThrow('could not interpret');
  });
  it('uses native Ollama API without key, tools, redirects, cloud fallback or assistant-role history', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(json(local)).mockResolvedValueOnce(json(generated()));
    vi.stubGlobal('fetch', fetch);
    await expect(provider().generate([{ role: 'user', content: 'SYNTHETIC-CONTEXT' }], ['system-home'])).resolves.toMatchObject({ inScope: true });
    expect(fetch.mock.calls[0][0]).toBe('http://127.0.0.1:11434/api/show');
    expect(fetch.mock.calls[0][1].body).not.toContain('SYNTHETIC-CONTEXT');
    const request = fetch.mock.calls[1][1];
    const body = JSON.parse(request.body);
    expect(body).toMatchObject({ model: 'physiquequest-phiq', think: false, stream: false, truncate: false, shift: false });
    expect(body).not.toHaveProperty('tools');
    expect(request.redirect).toBe('error'); expect(request.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.stringify(request.headers).toLowerCase()).not.toContain('authorization');
  });
  it.each([{ ...local, remote_model: 'hidden-cloud' }, { ...local, remote_host: 'https://ollama.com' }, { ...local, modelfile: 'FROM minimax:cloud' }])('blocks remotely backed aliases before sending text', async info => {
    const fetch = vi.fn().mockResolvedValue(json(info)); vi.stubGlobal('fetch', fetch);
    await expect(provider().generate([{ role: 'user', content: 'PRIVATE' }], ['system-home'])).rejects.toThrow('private model is unavailable');
    expect(fetch).toHaveBeenCalledOnce(); expect(fetch.mock.calls[0][1].body).not.toContain('PRIVATE');
  });
  it.each([
    generated({ inScope: true, answer: 'Invented', sourceIds: ['foreign-record'] }),
    generated({ inScope: true, answer: 'No source', sourceIds: [] }),
    generated({ inScope: true, answer: '', sourceIds: ['system-home'] }),
    { ...generated(), done_reason: 'length' }, { ...generated(), message: { content: 'not json' } },
    { ...generated(), message: { content: '{}', tool_calls: [{ function: 'db' }] } },
  ])('fails closed on malformed or ungrounded responses', async result => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(json(local)).mockResolvedValueOnce(json(result)));
    await expect(provider().generate([], ['system-home'])).rejects.toThrow('private model is unavailable');
  });
  it('bounds response size and does not expose upstream errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(json(local)).mockResolvedValueOnce(json({ secret: 'x'.repeat(40000) })));
    await expect(provider().generate([], ['system-home'])).rejects.toThrow('private model is unavailable');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('SECRET URL AND TOKEN')));
    await expect(provider().generate([], ['system-home'])).rejects.not.toThrow('SECRET');
  });
  it('rejects excess concurrent inference and releases slots after failures', async () => {
    let release!: () => void;
    const blocked = new Promise<Response>(resolve => { release = () => resolve(json({}, 503)); });
    vi.stubGlobal('fetch', vi.fn(() => blocked));
    const instance = provider();
    const first = instance.generate([], ['system-home']); const second = instance.generate([], ['system-home']);
    const failures = Promise.allSettled([first, second]);
    await expect(instance.generate([], ['system-home'])).rejects.toThrow('busy');
    release(); await failures;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(json(local)).mockResolvedValueOnce(json(generated())));
    await expect(instance.generate([], ['system-home'])).resolves.toHaveProperty('answer');
  });
  it.each([
    { CHAT_OLLAMA_URL: 'https://ollama.com' }, { CHAT_OLLAMA_URL: 'http://169.254.169.254' },
    { CHAT_OLLAMA_URL: 'http://localhost@evil.example' }, { CHAT_OLLAMA_URL: 'http://127.0.0.1/api' },
    { CHAT_OLLAMA_URL: 'http://127.0.0.1?redirect=evil' }, { CHAT_OLLAMA_MODEL: 'safe:cloud' },
    { CHAT_OLLAMA_MODEL: 'namespace/remote' }, { CHAT_TIMEOUT_MS: '60000' },
  ])('rejects unsafe config %j', env => expect(() => chatConfig(env)).toThrow());
  it.each(['http://127.0.0.1:11434', 'http://localhost:11434', 'http://[::1]:11434', 'http://ollama:11434', 'http://10.0.0.5:11434', 'http://172.16.0.2:11434', 'https://192.168.0.2:11434'])('allows private runtime %s', url => {
    expect(chatConfig({ CHAT_OLLAMA_URL: url }).url).toBe(new URL(url).origin);
  });

  it('keeps the model warm, limits generation, and reuses only short-lived local metadata', async () => {
    const fetch = vi.fn(async (url: string) => json(url.endsWith('/show') ? local : generated()));
    vi.stubGlobal('fetch', fetch);
    const instance = provider();
    await instance.generate([], ['system-home']); await instance.generate([], ['system-home']);
    expect(fetch.mock.calls.filter(([url]) => url.endsWith('/show'))).toHaveLength(1);
    const body = JSON.parse((fetch.mock.calls.at(-1) as any)[1].body);
    expect(body.keep_alive).toBe('30m'); expect(body.options.num_predict).toBe(384);
    expect(body.options.num_ctx).toBe(8192);
  });

  it('expires metadata and rechecks before private text after the configured TTL', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-29T00:00:00Z'));
    const fetch = vi.fn(async (url: string) => json(url.endsWith('/show') ? local : generated()));
    vi.stubGlobal('fetch', fetch);
    const instance = provider(); await instance.generate([], ['system-home']);
    vi.setSystemTime(new Date('2026-10-29T00:00:31Z'));
    await instance.generate([], ['system-home']);
    expect(fetch.mock.calls.filter(([url]) => url.endsWith('/show'))).toHaveLength(2);
  });

  it('invalidates cached local metadata when the endpoint or model changes', async () => {
    const config: Record<string, string> = {};
    const fetch = vi.fn(async (url: string) => json(url.includes(':11435/') ? { ...local, remote_host: 'https://ollama.com' } : url.endsWith('/show') ? local : generated()));
    vi.stubGlobal('fetch', fetch);
    const instance = provider(config); await instance.generate([], ['system-home']);
    config.CHAT_OLLAMA_URL = 'http://127.0.0.1:11435';
    await expect(instance.generate([{ role: 'user', content: 'PRIVATE-NEW-ENDPOINT' }], ['system-home'])).rejects.toThrow('private model is unavailable');
    const request = (fetch.mock.calls.at(-1) as any)[1];
    expect(request.body).not.toContain('PRIVATE-NEW-ENDPOINT');
  });

  it('preloads without prompts and reports only generic readiness', async () => {
    const fetch = vi.fn(async (url: string) => json(url.endsWith('/show') ? local : url.endsWith('/ps') ? { models: [{ name: 'physiquequest-phiq:latest' }] } : { done: true }));
    vi.stubGlobal('fetch', fetch);
    const instance = provider();
    expect(await instance.warmup()).toEqual({ ready: true });
    expect(JSON.parse((fetch.mock.calls.find(([url]) => url.endsWith('/chat')) as any)[1].body)).toMatchObject({ messages: [], keep_alive: '30m' });
    expect(await instance.status()).toEqual({ ready: true });
    instance.onModuleDestroy();
    expect(await instance.status()).toEqual({ ready: false });
  });

  it('automatically warms production in the background and stops maintenance on shutdown', async () => {
    vi.useFakeTimers();
    const instance = provider({ NODE_ENV: 'production' });
    const warm = vi.spyOn(instance, 'warmup').mockResolvedValue({ ready: true });
    instance.onApplicationBootstrap(); expect(warm).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(15 * 60000); expect(warm).toHaveBeenCalledTimes(2);
    instance.onModuleDestroy();
    await vi.advanceTimersByTimeAsync(15 * 60000); expect(warm).toHaveBeenCalledTimes(2);
  });

  it('pins explicitly allowed private DNS names into the actual socket lookup', async () => {
    const received: { path: string; body: string }[] = [];
    const server = createServer(async (req, res) => {
      let body = ''; for await (const chunk of req) body += chunk;
      received.push({ path: req.url!, body });
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(req.url === '/api/show' ? local : generated()));
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
      const port = (server.address() as { port: number }).port;
      dnsLookup.mockResolvedValue([{ address: '127.0.0.1', family: 4 }]);
      const instance = provider({ CHAT_OLLAMA_URL: 'http://phiq-inference.internal:' + port, CHAT_OLLAMA_ALLOWED_HOSTS: 'phiq-inference.internal' });
      expect(await instance.generate([{ role: 'user', content: 'SYNTHETIC-PINNED' }], ['system-home'])).toHaveProperty('answer');
      expect(received.map(item => item.path)).toEqual(['/api/show', '/api/chat']);
      expect(received[0].body).not.toContain('SYNTHETIC-PINNED');
      expect(received[1].body).toContain('SYNTHETIC-PINNED');
      expect(dnsLookup).toHaveBeenCalledTimes(2);
    } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
  });

  it('blocks DNS rebinding to public addresses before conversation transmission', async () => {
    const received: string[] = [];
    const server = createServer((req, res) => { received.push(req.url!); res.end(JSON.stringify(local)); });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
      const port = (server.address() as { port: number }).port;
      dnsLookup.mockResolvedValueOnce([{ address: '127.0.0.1', family: 4 }]).mockResolvedValueOnce([{ address: '8.8.8.8', family: 4 }]);
      const instance = provider({ CHAT_OLLAMA_URL: 'http://phiq-inference.internal:' + port, CHAT_OLLAMA_ALLOWED_HOSTS: 'phiq-inference.internal' });
      await expect(instance.generate([{ role: 'user', content: 'PRIVATE-MUST-STAY-LOCAL' }], ['system-home'])).rejects.toThrow('private model is unavailable');
      expect(received).toEqual(['/api/show']);
    } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
  });

  it.each(['169.254.169.254', '8.8.8.8', 'fe80::1', '2001:4860:4860::8888'])('does not consider metadata/public addresses private: %s', address => expect(isPrivateChatAddress(address)).toBe(false));
  it.each([
    { CHAT_OLLAMA_ALLOWED_HOSTS: '*.internal' }, { CHAT_OLLAMA_ALLOWED_HOSTS: 'http://private.internal' },
    { CHAT_KEEP_ALIVE: 'forever' }, { CHAT_MAX_CONCURRENCY: '0' }, { CHAT_MODEL_CHECK_TTL_MS: '60001' },
    { CHAT_MAX_OUTPUT_TOKENS: '99999' }, { CHAT_WARMUP_ENABLED: 'yes' },
  ])('validates production tuning %j', env => expect(() => chatConfig(env)).toThrow());
});
