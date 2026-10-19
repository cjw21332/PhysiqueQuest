import { readFileSync } from 'node:fs';
import { dirname, resolve, relative } from 'node:path';
import ts from 'typescript';
import { expect, it } from 'vitest';

it('keeps API watch, Coach watch and production compiler outputs separate', () => {
  const root = resolve(import.meta.dirname, '..');
  const { scripts } = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
  const outputs = ['start:dev', 'start:coach:dev', 'build'].map((script) => {
    const filename = resolve(root, scripts[script].match(/--path\s+(\S+)/)?.[1] ?? 'tsconfig.build.json');
    const config = ts.readConfigFile(filename, ts.sys.readFile);
    expect(config.error).toBeUndefined();
    const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, dirname(filename));
    expect(parsed.errors).toEqual([]);
    return parsed.options.outDir;
  });
  expect(new Set(outputs).size).toBe(3);
  expect(scripts['start:debug']).toContain('--path tsconfig.dev.json');
  expect(relative(root, outputs[2])).toBe('dist');
});
