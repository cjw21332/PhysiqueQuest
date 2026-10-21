import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { retentionDefaults } from '../src/privacy/retention.js';

/**
 * The environment variable list is a contract: operators set these in a hosting
 * dashboard and read the tables to know what exists. A variable read by the code
 * but documented nowhere is exactly the drift this catches.
 *
 * The scanner reads configuration through ConfigService rather than
 * `process.env`, so the extraction looks for `config.get*('NAME')` calls.
 */

const BACKEND_ROOT = path.resolve(import.meta.dirname, '..');
const SRC_ROOT = path.join(BACKEND_ROOT, 'src');

const read = (relPath: string) => readFileSync(path.join(BACKEND_ROOT, relPath), 'utf8');

/**
 * Every environment variable reference in the source.
 *
 * Matches both `configService.get<string>('NAME')` and the local `read('NAME')`
 * helper that foodscan-config.ts uses, since both are how this codebase reads
 * configuration.
 */
function envVarsInSource(): Set<string> {
  const found = new Set<string>(Object.keys(retentionDefaults));
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
        continue;
      }
      if (!/\.(ts|js|mjs)$/.test(entry)) continue;
      const src = readFileSync(full, 'utf8');
      const patterns = [/\.(?:get|getOrThrow)(?:<[^>]*>)?\('([A-Z][A-Z0-9_]+)'\)/g, /\bread\('([A-Z][A-Z0-9_]+)'\)/g, /\benv\.([A-Z][A-Z0-9_]+)/g, /'((?:CDN_|BACKUP_)[A-Z0-9_]+)'/g];
      for (const pattern of patterns) {
        for (const m of src.matchAll(pattern)) found.add(m[1]);
      }
    }
  };
  walk(SRC_ROOT);
  walk(path.join(BACKEND_ROOT, 'scripts'));
  return found;
}

/** Provided by the platform or the Nest runtime, not by the operator. */
const PLATFORM_MANAGED = new Set(['NODE_ENV', 'PORT', 'NPM_CONFIG_UPDATE_NOTIFIER']);

describe('environment variable documentation stays in sync with the code', () => {
  const declared = [...envVarsInSource()].filter((k) => !PLATFORM_MANAGED.has(k)).sort();
  const example = read('.env.example');
  const readme = read('README.md');

  it('finds the variables the service actually reads', () => {
    // Guards against the extraction silently matching nothing.
    expect(declared.length).toBeGreaterThan(5);
    expect(declared).toContain('JWT_SECRET');
    expect(declared).toContain('GEMINI_API_KEY');
    expect(declared).toContain('USDA_API_KEY');
  });

  it.each(declared)('documents %s in .env.example', (name) => {
    // The example may list a variable as a comment (# NAME=...) so it stays
    // discoverable without being forced on the operator.
    expect(`${example}\n`).toMatch(new RegExp(`^#?\\s*${name}=`, 'm'));
  });

  it('does not list a variable in .env.example that the service never reads', () => {
    // Catches a stale example entry that does nothing.
    const listed = [...example.matchAll(/^#?\s*([A-Z][A-Z0-9_]+)=/gm)].map((m) => m[1]);
    const known = new Set([...declared, ...PLATFORM_MANAGED]);
    expect(listed.filter((k) => !known.has(k))).toEqual([]);
  });

  it('leaves the provider keys empty so they are not mistaken for real ones', () => {
    expect(example).toMatch(/^GEMINI_API_KEY=\s*$/m);
    expect(example).toMatch(/^USDA_API_KEY=\s*$/m);
  });

  it('marks the JWT secret as a placeholder rather than a usable value', () => {
    const secret = example.match(/^JWT_SECRET=(.+)$/m)?.[1].trim() ?? '';
    expect(secret.toLowerCase()).toContain('replace_with');
  });

  it('documents every scanner limit the config layer reads', () => {
    // These are the easy ones to forget and the most confusing to debug.
    for (const name of [
      'FOODSCAN_MAX_IMAGE_BYTES',
      'FOODSCAN_MAX_BODY_BYTES',
      'FOODSCAN_MAX_SEARCH_QUERY_LENGTH',
      'FOODSCAN_MAX_DETECTED_ITEMS',
      'FOODSCAN_REQUEST_TIMEOUT_MS',
      'FOODSCAN_UPSTREAM_TIMEOUT_MS',
      'FOODSCAN_RATE_LIMIT_MAX',
      'TRUST_PROXY_HOPS',
    ]) {
      expect(declared, `${name} is read by the config layer`).toContain(name);
    }
  });

  it('documents the scan routes in the README', () => {
    for (const route of [
      '/api/nutrition/scan',
      '/api/nutrition/foods/search',
      '/api/nutrition/meals/from-scan',
    ]) {
      expect(readme, `README does not mention ${route}`).toContain(route);
    }
  });

  it('states that the provider keys are optional', () => {
    // The scanner used to refuse to boot without credentials; it no longer does,
    // and an operator reading only the README must not assume otherwise.
    expect(readme).toMatch(/optional/i);
  });
});
