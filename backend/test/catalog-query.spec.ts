import { describe, expect, it } from 'vitest';
import { parseCatalogQuery } from '../src/exercises/catalog-query.js';
describe('catalog query validation', () => {
  it('parses bounded scalar parameters and rejects operator/object injection or unknown fields', () => {
    expect(parseCatalogQuery({ page: '2', limit: '12', search: 'squat' })).toMatchObject({ page: 2, limit: 12 });
    for (const input of [{ search: { $ne: '' } }, { search: ['squat'] }, { page: 'banana' }, { unknown: 'x' }]) expect(() => parseCatalogQuery(input)).toThrow();
  });
});
