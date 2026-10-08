import { afterEach, describe, expect, it, vi } from 'vitest';
import { FoodScanConfigService } from './foodscan-config.js';
import { HttpService } from './http.service.js';

describe('food scan upstream HTTP', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('retries a transient upstream server error once when enabled', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('temporarily unavailable', { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ foods: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }));
    vi.stubGlobal('fetch', fetchMock);

    const http = new HttpService({
      value: { upstreamTimeoutMs: 1000 },
    } as FoodScanConfigService);

    await expect(http.fetchJson('https://nutrition.example/search', {
      upstream: 'nutrition database',
      retryServerErrors: true,
    })).resolves.toEqual({ foods: [] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry provider rate limits', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('rate limited', { status: 429 }));
    vi.stubGlobal('fetch', fetchMock);

    const http = new HttpService({
      value: { upstreamTimeoutMs: 1000 },
    } as FoodScanConfigService);

    await expect(http.fetchJson('https://nutrition.example/search', {
      upstream: 'nutrition database',
      retryServerErrors: true,
    })).rejects.toMatchObject({ code: 'PROVIDER_RATE_LIMITED' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
