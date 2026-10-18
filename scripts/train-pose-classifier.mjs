import { readFile, writeFile } from 'node:fs/promises';
import ts from 'typescript';
const [input, output] = process.argv.slice(2);
if (!input || !output) throw new Error('Usage: node scripts/train-pose-classifier.mjs <labeled-motion.json> <candidate-model.json>');
const load = async path => {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {}; new Function('exports', js)(exports); return exports;
};
const dataset = JSON.parse(await readFile(input, 'utf8'));
if (dataset.purpose === 'held-out-evaluation-only' || /(?:qevd.*benchmark|qualcomm-exercise-video-dataset-benchmark)/i.test(String(dataset.source ?? ''))) throw new Error('Held-out Qualcomm benchmark data must not be used for training or model selection. Use a separately licensed training dataset.');
if (dataset.exercises || !dataset.license || !dataset.source || !Array.isArray(dataset.rows)) throw new Error('Supply a licensed labeled motion dataset. RepDB exercise descriptions/still illustrations are not repetition sequences.');
const [{ trainPosePhaseModel }, { trackingKinds }] = await Promise.all([load('../shared/poseClassifier.ts'), load('../shared/repCounter.ts')]);
const { model, report } = trainPosePhaseModel(dataset.rows, trackingKinds, { coordinates: dataset.coordinates ?? 'image', neighbours: 3, maximumDistance: .35, minimumVote: .8 });
await writeFile(output, JSON.stringify({ ...model, provenance: { source: dataset.source, license: dataset.license }, validation: report }, null, 2));
console.log(JSON.stringify(report, null, 2));
console.log('Candidate only: no app activation or automatic release clearance.');
