import { outboundFetch, resetOutboundCircuits, withCircuit } from '../src/common/outbound.js';
describe('bounded provider circuit', () => {
  afterEach(() => { resetOutboundCircuits(); vi.useRealTimers(); vi.restoreAllMocks(); });
  it('opens after repeated failures and permits one recovery probe after cooldown', async () => {
    vi.useFakeTimers();
    const failure = vi.fn(async () => { throw Error('unavailable'); });
    for (let i = 0; i < 5; i++) await expect(withCircuit('provider', failure)).rejects.toThrow();
    await expect(withCircuit('provider', failure)).rejects.toThrow('circuit open');
    expect(failure).toHaveBeenCalledTimes(5);
    vi.advanceTimersByTime(30_001);
    expect(await withCircuit('provider', async () => 'recovered')).toBe('recovered');
  });
  it('does not follow provider redirects or retry writes', async () => {
    const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 503 }));
    expect((await outboundFetch('https://provider.example.invalid/send', { method: 'POST' })).status).toBe(503);
    expect(fetcher).toHaveBeenCalledOnce(); expect(fetcher).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ redirect: 'error', signal: expect.any(AbortSignal) }));
  });
});
