import type { TrackingFrame, TrackingKind, TrackingSide } from './repCounter';

const featureIndices = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
export type PhaseLabel = { kind: TrackingKind; side: TrackingSide; phase: 'ready' | 'active' };
export type PosePhaseModel = { version: 1; features: 'body-relative-v1'; coordinates: 'image' | 'world'; neighbours: number; maximumDistance: number; minimumVote: number; samples: { label: PhaseLabel; values: number[] }[] };
export type LabeledPose = { clipId: string; groupId: string; split: 'train' | 'validation'; label: PhaseLabel | null; frame: TrackingFrame };
const key = (label: PhaseLabel) => `${label.kind}:${label.side}:${label.phase}`;
function validLabel(label: PhaseLabel, kinds: readonly string[]) { return label && kinds.includes(label.kind) && ['left', 'right'].includes(label.side) && ['ready', 'active'].includes(label.phase); }
export function poseFeatures(frame: TrackingFrame, coordinates: 'image' | 'world'): number[] | null {
  if (!frame || frame.joints?.length !== 33 || !Number.isFinite(frame.aspect) || frame.aspect <= 0) return null;
  const image = featureIndices.map(index => frame.joints[index]);
  if (image.some(joint => !joint || !Number.isFinite(joint.x) || !Number.isFinite(joint.y) || joint.x < 0 || joint.x > 1 || joint.y < 0 || joint.y > 1 || !Number.isFinite(joint.visibility) || (joint.visibility ?? 0) < .65 || (joint.presence !== undefined && (!Number.isFinite(joint.presence) || joint.presence < .65)))) return null;
  if (coordinates === 'world' && frame.worldJoints?.length !== 33) return null;
  const points = featureIndices.map(index => coordinates === 'world' ? frame.worldJoints![index] : { x: frame.joints[index].x * frame.aspect, y: frame.joints[index].y, z: 0 });
  if (points.some(point => !point || ![point.x, point.y, point.z].every(Number.isFinite))) return null;
  const center = { x: (points[6].x + points[7].x) / 2, y: (points[6].y + points[7].y) / 2, z: (points[6].z + points[7].z) / 2 };
  const scale = Math.hypot((points[0].x + points[1].x) / 2 - center.x, (points[0].y + points[1].y) / 2 - center.y, (points[0].z + points[1].z) / 2 - center.z);
  if (!Number.isFinite(scale) || scale < 1e-4) return null;
  const values = points.flatMap(point => [(point.x - center.x) / scale, (point.y - center.y) / scale, (point.z - center.z) / scale]);
  return values.every(value => Number.isFinite(value) && Math.abs(value) <= 10) ? values : null;
}
export function validatePhaseModel(model: PosePhaseModel, allowedKinds: readonly string[]) {
  if (!model || model.version !== 1 || model.features !== 'body-relative-v1' || !['image', 'world'].includes(model.coordinates) ||
    !Number.isInteger(model.neighbours) || model.neighbours < 1 || model.neighbours > 9 || model.neighbours % 2 !== 1 ||
    !Number.isFinite(model.maximumDistance) || model.maximumDistance <= 0 || model.maximumDistance > 5 ||
    !Number.isFinite(model.minimumVote) || model.minimumVote <= .5 || model.minimumVote > 1 ||
    !Array.isArray(model.samples) || model.samples.length < model.neighbours || model.samples.length > 5000 ||
    model.samples.some(sample => !validLabel(sample.label, allowedKinds) || !Array.isArray(sample.values) || sample.values.length !== 36 || !sample.values.every(value => Number.isFinite(value) && Math.abs(value) <= 10))) throw new Error('Invalid pose-phase model');
}
export function createPosePhaseClassifier(model: PosePhaseModel, allowedKinds: readonly string[]) {
  validatePhaseModel(model, allowedKinds);
  // Copy caller-owned data so later mutation cannot change a validated model.
  const samples = model.samples.map(sample => ({ label: { ...sample.label }, values: [...sample.values] }));
  const { neighbours, maximumDistance, minimumVote, coordinates } = model;
  return { version: 'pose-knn-v1', kinds: [...new Set(samples.map(sample => sample.label.kind))],
    classify(frame: TrackingFrame) {
      const values = poseFeatures(frame, coordinates);
      if (!values) return null;
      const rankedSamples = samples.map(sample => ({ ...sample, distance: Math.sqrt(sample.values.reduce((sum, value, index) => sum + (value - values[index]) ** 2, 0) / values.length) }))
        .sort((a, b) => a.distance - b.distance);
      const boundary = rankedSamples[neighbours - 1].distance;
      // Include tied neighbours: identical shared start poses must not depend on input ordering.
      const closest = rankedSamples.filter(sample => sample.distance <= boundary + 1e-10);
      if (closest.some(sample => sample.distance > maximumDistance)) return null;
      const votes = new Map<string, { label: PhaseLabel; count: number }>();
      for (const sample of closest) { const id = key(sample.label); const row = votes.get(id) ?? { label: sample.label, count: 0 }; row.count++; votes.set(id, row); }
      const ranked = [...votes.values()].sort((a, b) => b.count - a.count);
      const winner = ranked[0];
      if (!winner || winner.count / closest.length < minimumVote) return null;
      return { ...winner.label, voteFraction: winner.count / closest.length, distance: closest[0].distance };
    } };
}
/** Train from explicit subject/session-separated splits; never use validation frames as neighbours. */
export function trainPosePhaseModel(rows: LabeledPose[], allowedKinds: readonly string[], options: Omit<PosePhaseModel, 'version' | 'features' | 'samples'>) {
  if (!Array.isArray(rows) || rows.length > 100000) throw new Error('Invalid labeled motion dataset');
  const groups = new Map<string, string>(), clips = new Map<string, string>();
  const samples: PosePhaseModel['samples'] = [], validation: { label: PhaseLabel | null; frame: TrackingFrame }[] = [];
  const labelGroups = new Map<string, Set<string>>();
  for (const row of rows) {
    if (!row || typeof row.clipId !== 'string' || !row.clipId || typeof row.groupId !== 'string' || !row.groupId || !['train', 'validation'].includes(row.split) || (row.label !== null && !validLabel(row.label, allowedKinds))) throw new Error('Invalid labeled motion row');
    if ((groups.has(row.groupId) && groups.get(row.groupId) !== row.split) || (clips.has(row.clipId) && clips.get(row.clipId) !== row.split)) throw new Error('Training/validation group leakage');
    groups.set(row.groupId, row.split); clips.set(row.clipId, row.split);
    const values = poseFeatures(row.frame, options.coordinates);
    if (!values) throw new Error('Dataset contains missing/invalid required landmarks');
    if (row.split === 'validation') { validation.push({ label: row.label, frame: row.frame }); continue; }
    if (!row.label) throw new Error('Unknown examples belong in validation, not labeled phase training');
    samples.push({ label: { ...row.label }, values });
    const id = key(row.label); const set = labelGroups.get(id) ?? new Set<string>(); set.add(row.groupId); labelGroups.set(id, set);
  }
  if (!validation.length || !samples.length || [...labelGroups.values()].some(set => set.size < 2)) throw new Error('Each training phase needs two independent groups and a held-out validation split');
  for (const sample of samples) if (!labelGroups.has(key({ ...sample.label, phase: sample.label.phase === 'ready' ? 'active' : 'ready' }))) throw new Error('Each exercise/side needs both ready and active phases');
  const model: PosePhaseModel = { version: 1, features: 'body-relative-v1', ...options, samples };
  const classifier = createPosePhaseClassifier(model, allowedKinds);
  const confusion: Record<string, Record<string, number>> = {};
  let matched = 0, rejected = 0, unknown = 0, falseAccepts = 0;
  for (const row of validation) {
    const predicted = classifier.classify(row.frame), expected = row.label ? key(row.label) : 'unknown', actual = predicted ? key(predicted) : 'unknown';
    const line = confusion[expected] ?? (confusion[expected] = {}); line[actual] = (line[actual] ?? 0) + 1;
    if (actual === expected) matched++; if (!predicted) rejected++;
    if (!row.label) { unknown++; if (predicted) falseAccepts++; }
  }
  return { model, report: { validationFrames: validation.length, matched, rejected, unknownFrames: unknown, falseAccepts, confusion,
    note: 'Held-out phase classification only. Real video rep-count error and Android performance remain separate release gates.' } };
}
