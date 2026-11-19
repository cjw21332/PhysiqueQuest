import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LocalChatProvider } from './local-chat.provider.js';
import { chatConfig, isPrivateChatAddress } from './chat-config.js';
import { openAIResponse } from '../common/openai.js';

vi.mock('../common/openai.js', () => ({ OPENAI_MODEL: 'gpt-6-luna', openAIResponse: vi.fn() }));
const provider = () => new LocalChatProvider({ get: () => undefined } as never);
const result = (value: unknown) => ({ content: JSON.stringify(value), usage: undefined });

describe('OpenAI chat boundary', () => {
  beforeEach(() => { vi.stubEnv('OPENAI_API_KEY', 'test-key'); vi.resetAllMocks(); });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
  it('uses the same configured model as meal scanning for routing and answers', async () => {
    vi.stubEnv('OPENAI_MODEL', 'scan-configured-model');
    vi.mocked(openAIResponse).mockResolvedValueOnce(result({ routeIds: ['nutrition.calorie-target'], timeframe: 'unspecified' }));
    vi.mocked(openAIResponse).mockResolvedValueOnce(result({ inScope: true, answer: 'Home shows activity.', sourceIds: ['system-home'] }));
    const instance = provider();
    await instance.routeQuestion('What is my energy allowance?', [], '/scan');
    await instance.generate([], ['system-home']);
    expect(vi.mocked(openAIResponse).mock.calls.map(call => call[3])).toEqual(['scan-configured-model', 'scan-configured-model']);
  });
  it('defaults to the shared model when no override is configured', async () => {
    vi.stubEnv('OPENAI_MODEL', '');
    vi.mocked(openAIResponse).mockResolvedValueOnce(result({ inScope: true, answer: 'Ready', sourceIds: ['system-home'] }));
    await provider().generate([], ['system-home']);
    expect(vi.mocked(openAIResponse).mock.calls[0][3]).toBe('gpt-6-luna');
  });
  it('checks readiness against the configured scan model', async () => {
    vi.stubEnv('OPENAI_MODEL', 'scan-configured-model');
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(provider().status()).resolves.toEqual({ ready: true });
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.openai.com/v1/models/scan-configured-model');
  });
  it('routes a question without sending saved records or assistant messages', async () => {
    vi.mocked(openAIResponse).mockResolvedValueOnce(result({ routeIds: ['nutrition.calorie-target'], timeframe: 'unspecified' }));
    expect(await provider().routeQuestion('What is my energy allowance?', [], '/scan')).toMatchObject({ decision: 'answer', routeIds: ['nutrition.calorie-target'] });
    const [input] = vi.mocked(openAIResponse).mock.calls[0];
    expect(JSON.stringify(input)).not.toContain('saved-record');
    expect((input as Array<{ role: string }>).every(message => message.role !== 'assistant')).toBe(true);
  });
  it.each([
    { routeIds: ['foreign-database-query'], timeframe: 'today' },
    { routeIds: ['nutrition.plan'], timeframe: 'today', userId: 'forged' },
    { routeIds: [], timeframe: 'today' },
    { routeIds: ['nutrition.plan', 'nutrition.plan'], timeframe: 'today' },
    { routeIds: ['nutrition.plan'], timeframe: 'invented' },
  ])('rejects invalid semantic output %j', async plan => {
    vi.mocked(openAIResponse).mockResolvedValueOnce(result(plan));
    await expect(provider().routeQuestion('Unfamiliar question')).rejects.toThrow('could not interpret');
  });
  it('returns a grounded answer using only allowed source IDs', async () => {
    vi.mocked(openAIResponse).mockResolvedValueOnce(result({ inScope: true, answer: 'Home shows activity.', sourceIds: ['system-home'] }));
    await expect(provider().generate([{ role: 'user', content: 'SYNTHETIC' }], ['system-home'])).resolves.toMatchObject({ inScope: true, sourceIds: ['system-home'] });
    expect(JSON.stringify(vi.mocked(openAIResponse).mock.calls[0][0])).toContain('SYNTHETIC');
  });
  it.each([
    { inScope: true, answer: 'Invented', sourceIds: ['foreign-record'] },
    { inScope: true, answer: 'No source', sourceIds: [] },
    { inScope: true, answer: '', sourceIds: ['system-home'] },
    { inScope: true, answer: 'Extra', sourceIds: ['system-home'], userId: 'forged' },
  ])('rejects ungrounded output %j', async value => {
    vi.mocked(openAIResponse).mockResolvedValueOnce(result(value));
    await expect(provider().generate([], ['system-home'])).rejects.toThrow('unavailable');
  });
  it('fails closed without credentials and does not expose provider errors', async () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    await expect(provider().generate([], ['system-home'])).rejects.toThrow('unavailable');
    expect(openAIResponse).not.toHaveBeenCalled();
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
    vi.mocked(openAIResponse).mockRejectedValueOnce(new Error('SECRET PROVIDER DETAILS'));
    await expect(provider().generate([], ['system-home'])).rejects.not.toThrow('SECRET');
  });
  it('limits concurrent requests and releases slots after failures', async () => {
    const releases: Array<() => void> = [];
    vi.mocked(openAIResponse).mockImplementation(() => new Promise((_, reject) => { releases.push(() => reject(new Error('failure'))); }));
    const instance = provider();
    const pending = [instance.generate([], ['system-home']), instance.generate([], ['system-home'])];
    const settled = Promise.allSettled(pending);
    await expect(instance.generate([], ['system-home'])).rejects.toThrow('busy');
    releases.forEach(release => release());
    await settled;
    vi.mocked(openAIResponse).mockResolvedValueOnce(result({ inScope: true, answer: 'Ready', sourceIds: ['system-home'] }));
    await expect(instance.generate([], ['system-home'])).resolves.toHaveProperty('answer', 'Ready');
  });
  it('cancels a disconnected request and releases provider capacity', async () => {
    const controller = new AbortController();
    vi.mocked(openAIResponse).mockImplementationOnce((_input, _tokens, signal) => new Promise((_, reject) => {
      signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
    }));
    const instance = provider();
    const pending = instance.generate([], ['system-home'], controller.signal);
    const finished = expect(pending).rejects.toThrow('unavailable');
    await vi.waitFor(() => expect(openAIResponse).toHaveBeenCalledOnce());
    controller.abort();
    await finished;
    vi.mocked(openAIResponse).mockResolvedValueOnce(result({ inScope: true, answer: 'Ready', sourceIds: ['system-home'] }));
    await expect(instance.generate([], ['system-home'])).resolves.toHaveProperty('answer', 'Ready');
  });
});

describe('legacy chat configuration validation', () => {
  it.each([{ CHAT_OLLAMA_URL: 'https://ollama.com' }, { CHAT_OLLAMA_URL: 'http://169.254.169.254' }, { CHAT_OLLAMA_MODEL: 'safe:cloud' }, { CHAT_MAX_CONCURRENCY: '0' }])('rejects unsafe config %j', env => expect(() => chatConfig(env)).toThrow());
  it.each(['169.254.169.254', '8.8.8.8', 'fe80::1'])('rejects public or metadata address %s', address => expect(isPrivateChatAddress(address)).toBe(false));
});
