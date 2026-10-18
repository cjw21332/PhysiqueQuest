import { readFile, writeFile } from 'node:fs/promises';
import ts from 'typescript';
import { assertBenchmark, evaluateBenchmark, sha256 } from './qevd-research.mjs';
const directory = new URL('../research-data/qevd/', import.meta.url);
const filename = process.argv[2] ?? 'manifest.reviewed.json';
if (!/^[a-zA-Z0-9._-]+\.json$/.test(filename)) throw new Error('Provide a manifest filename inside research-data/qevd');
const body = await readFile(new URL(filename, directory), 'utf8');
const manifest = JSON.parse(body);
assertBenchmark(manifest);
const source = await readFile(new URL('../shared/repCounter.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const engine = {}; new Function('exports', js)(engine);
const poses = new Map();
for (const video of manifest.videos) {
  if (!/^\d+$/.test(video.videoId)) throw new Error('Invalid video ID');
  try { poses.set(video.videoId, JSON.parse(await readFile(new URL(`poses-${video.videoId}.json`, directory), 'utf8'))); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}
const report = { ...evaluateBenchmark(manifest, poses, engine), manifestSha256: sha256(body), engineSha256: sha256(source) };
await writeFile(new URL('evaluation.json', directory), JSON.stringify(report, null, 2));
const { results: _results, ...summary } = report;
console.log(JSON.stringify(summary, null, 2));
console.log('No app changes or model activation. Null accuracy/error means there are no scored examples.');
