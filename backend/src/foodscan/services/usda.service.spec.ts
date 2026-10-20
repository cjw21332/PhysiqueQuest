import { afterEach, describe, expect, it, vi } from 'vitest';
import { FoodScanConfigService } from '../../common/foodscan/foodscan-config.js';
import { UsdaService } from './usda.service.js';

describe('USDA search request construction', () => {
  afterEach(() => vi.restoreAllMocks());

  it('sends food search terms and USDA data types as a JSON POST body', async () => {
    const fetchJson = vi.fn().mockResolvedValue({ foods: [] });
    const service = new UsdaService(
      {
        value: {
          usda: {
            apiKey: 'test-key',
            base: 'https://api.nal.usda.gov/fdc/v1/',
            configured: true,
          },
        },
      } as FoodScanConfigService,
      { fetchJson } as never,
    );

    await service.searchCandidates('chicken & rice, raw');

    const requestedUrl = new URL(fetchJson.mock.calls[0][0] as string);
    expect(requestedUrl.pathname).toBe('/fdc/v1/foods/search');
    expect(requestedUrl.searchParams.get('api_key')).toBe('test-key');
    expect([...requestedUrl.searchParams.keys()]).toEqual(['api_key']);
    const options = fetchJson.mock.calls[0][1];
    expect(options.method).toBe('POST');
    expect(options.headers['content-type']).toBe('application/json');
    expect(JSON.parse(options.body)).toEqual({ query: 'chicken & rice, raw', pageSize: 25, dataType: ['Foundation', 'SR Legacy', 'Survey (FNDDS)', 'Branded'] });
  });
});
