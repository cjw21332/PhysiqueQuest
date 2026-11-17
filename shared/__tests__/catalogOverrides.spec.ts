import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { isPatternId } from '../exerciseEngine';

const coverage = JSON.parse(readFileSync(new URL('../../output/exercisedb-v1-tracking-coverage.json', import.meta.url), 'utf8')) as {
  counts: Record<string, number>;
  overrideCount: number;
  modeOverrideCount: number;
  records: Array<{
    id: string;
    name: string;
    pattern: string | null;
    support: string;
    override: Record<string, unknown> | null;
    overrideBasis: string[];
  }>;
};

const ids = new Set(coverage.records.map(record => record.id));

describe('catalog-derived overrides', () => {
  it('covers all 1500 real catalog IDs once and never claims full support', () => {
    expect(coverage.records).toHaveLength(1500);
    expect(ids.size).toBe(1500);
    expect(coverage.counts.FULLY_SUPPORTED ?? 0).toBe(0);
    expect(coverage.counts.PARTIALLY_SUPPORTED + coverage.counts.NOT_YET_VALIDATED + coverage.counts.UNSUPPORTED).toBe(1500);
  });

  it('only attaches overrides to implemented, non-unsupported patterns', () => {
    for (const record of coverage.records) {
      if (!record.override) continue;
      expect(record.support).not.toBe('UNSUPPORTED');
      expect(record.pattern && isPatternId(record.pattern)).toBe(true);
      expect(record.overrideBasis.length).toBeGreaterThan(0);
    }
  });

  it('keeps every override inside the engine-safe bounds', () => {
    for (const record of coverage.records) {
      if (!record.override) continue;
      const value = record.override;
      for (const key of Object.keys(value)) {
        expect(['mode', 'view', 'visibility', 'minRom', 'minRepMs', 'maxRepMs', 'dwellMs', 'hold']).toContain(key);
      }
      if ('mode' in value) expect(['bilateral', 'per_side']).toContain(value.mode);
      if ('view' in value) expect(['front', 'side']).toContain(value.view);
      if ('visibility' in value) expect(Number(value.visibility)).toBeGreaterThanOrEqual(0.2);
      if ('visibility' in value) expect(Number(value.visibility)).toBeLessThanOrEqual(0.9);
      if ('minRom' in value) expect(Number(value.minRom)).toBeGreaterThanOrEqual(5);
      if ('minRepMs' in value) expect(Number(value.minRepMs)).toBeGreaterThanOrEqual(200);
      if ('maxRepMs' in value) expect(Number(value.maxRepMs)).toBeLessThanOrEqual(30000);
      if ('dwellMs' in value) expect(Number(value.dwellMs)).toBeLessThanOrEqual(500);
    }
  });

  it('never changes the counting mode of an isometric hold', () => {
    for (const record of coverage.records) {
      if (record.pattern === 'core_isometric' || record.pattern === 'squat_hold') {
        expect(record.override?.mode).toBeUndefined();
      }
    }
  });

  it('records metadata basis for the known unilateral, fast and occluded samples', () => {
    const unilateral = coverage.records.find(record => record.id === '0jp9Rlz');
    expect(unilateral?.pattern).toBe('calf_raise');
    expect(unilateral?.override?.mode).toBe('per_side');
    expect(unilateral?.overrideBasis.join(' ')).toMatch(/unilateral|alternating/i);

    const fast = coverage.records.find(record => record.name === 'barbell jump squat');
    expect(fast?.override?.minRepMs).toBe(250);

    const occluded = coverage.records.find(record => record.name === 'sled 45° leg press');
    expect(occluded?.override?.visibility).toBe(0.45);
    expect(occluded?.overrideBasis.join(' ')).toMatch(/occlude/i);
  });

  it('counts match the records actually carrying overrides', () => {
    const withOverride = coverage.records.filter(record => record.override).length;
    const withMode = coverage.records.filter(record => record.override?.mode).length;
    expect(coverage.overrideCount).toBe(withOverride);
    expect(coverage.modeOverrideCount).toBe(withMode);
  });
});
