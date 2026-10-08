import { afterEach, describe, expect, it, vi } from 'vitest';
import { FoodScanConfigService } from '../../common/foodscan/foodscan-config.js';
import { UsdaService } from './usda.service.js';

describe('USDA search request construction', () => {
  afterEach(() => vi.restoreAllMocks());

  it('encodes search terms and USDA data types as query parameters', async () => {
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
    expect(requestedUrl.searchParams.get('query')).toBe('chicken & rice, raw');
    expect(requestedUrl.searchParams.get('pageSize')).toBe('25');
    expect(requestedUrl.searchParams.get('dataType')).toBe(
      'Foundation,SR Legacy,Survey (FNDDS),Branded',
    );
  });
});
