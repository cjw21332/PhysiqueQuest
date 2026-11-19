#!/usr/bin/env node
/**
 * Export reviewed contribution clips as a training-ready dataset.
 *
 * Only annotator-accepted clips are exported. The output contains the subject
 * pseudonym, never the account id, email or any other identity field; this is
 * asserted before anything is written.
 *
 * Usage
 *   node scripts/export-dataset.mjs --out ../ml/data/contributions/v1 --version 2026-11-16
 *   node scripts/export-dataset.mjs --out /tmp/ds --version exp1 --status pending_annotation
 */
import { MongoClient } from 'mongodb';
import { gunzipSync } from 'node:zlib';
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';

const FORBIDDEN_KEYS = new Set(['userId', 'userid', '_id', 'email', 'displayName', 'passwordHash']);

/** Build the export tree in memory so tests and dry runs need no filesystem. */
export function buildExport(clips, payloads, { version, datasetLicence }) {
  const payloadById = new Map(payloads.map(record => [String(record.clipId), record]));
  const files = [];
  const index = [];
  for (const clip of clips) {
    const payloadRecord = payloadById.get(String(clip._id));
    if (!payloadRecord) continue;
    const payload = JSON.parse(gunzipSync(payloadRecord.data).toString('utf8'));
    const body = {
      clipId: String(clip._id),
      subjectPseudonym: clip.subjectPseudonym,
      exerciseId: clip.annotation?.exerciseId ?? clip.exerciseId,
      exerciseName: clip.exerciseName,
      pattern: clip.annotation?.pattern ?? clip.pattern,
      correctness: clip.annotation?.correctness ?? null,
      cameraPlacement: clip.cameraPlacement,
      cameraFacing: clip.cameraFacing,
      orientation: clip.orientation,
      durationSeconds: clip.durationSeconds,
      appVersion: clip.appVersion,
      consentVersion: clip.consentVersion,
      annotation: clip.annotation
        ? {
            correctness: clip.annotation.correctness,
            movementStartFrame: clip.annotation.movementStartFrame ?? null,
            movementEndFrame: clip.annotation.movementEndFrame ?? null,
            repBoundaries: clip.annotation.repBoundaries ?? [],
            phases: clip.annotation.phases ?? [],
            formDeviations: clip.annotation.formDeviations ?? [],
            keypointQuality: clip.annotation.keypointQuality,
          }
        : null,
      payload,
    };
    for (const key of Object.keys(body)) {
      if (FORBIDDEN_KEYS.has(key)) throw new Error(`export would leak identity field: ${key}`);
    }
    const relative = join(body.pattern, `${String(clip._id)}.json`);
    files.push({ relative, body });
    index.push({
      clipId: body.clipId,
      file: relative.split('\\').join('/'),
      subjectPseudonym: body.subjectPseudonym,
      pattern: body.pattern,
      exerciseId: body.exerciseId,
      correctness: body.correctness,
      keypointQuality: body.annotation?.keypointQuality ?? null,
      orientation: body.orientation,
      cameraPlacement: body.cameraPlacement,
      durationSeconds: body.durationSeconds,
      sha256: createHash('sha256').update(JSON.stringify(body)).digest('hex'),
    });
  }
  const manifest = {
    dataset: 'physiquequest_contributions',
    version,
    licence: datasetLicence,
    exportedAt: new Date().toISOString(),
    preprocessing: 'FEATURE_SPEC v1.1 (raw visibility) + live capture pipeline tag',
    clips: index.length,
    subjects: [...new Set(index.map(item => item.subjectPseudonym))].sort(),
    patterns: [...new Set(index.map(item => item.pattern))].sort(),
    files: index,
  };
  return { manifest, files };
}

async function main() {
  const args = process.argv.slice(2);
  const value = flag => {
    const position = args.indexOf(flag);
    return position >= 0 ? args[position + 1] : undefined;
  };
  const out = value('--out');
  const version = value('--version');
  const status = value('--status') || 'accepted';
  if (!out || !version) throw new Error('--out and --version are required');
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required');

  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  try {
    const db = client.db(process.env.MONGODB_DB || undefined);
    const clips = await db.collection('dataset_clips').find({ status }).sort({ _id: 1 }).toArray();
    const ids = clips.map(clip => clip._id);
    const payloads = await db.collection('dataset_clip_payloads').find({ clipId: { $in: ids } }).toArray();
    const { manifest, files } = buildExport(clips, payloads, {
      version,
      datasetLicence: process.env.DATASET_EXPORT_LICENCE || 'PhysiqueQuest contribution terms; research use',
    });
    const root = resolve(out);
    for (const file of files) {
      const target = join(root, file.relative);
      await mkdir(join(target, '..'), { recursive: true });
      await writeFile(target, JSON.stringify(file.body, null, 0));
    }
    await mkdir(root, { recursive: true });
    await writeFile(join(root, 'manifest.json'), JSON.stringify(manifest, null, 2));
    console.log(`exported ${manifest.clips} clips from ${manifest.subjects.length} subjects to ${root}`);
    console.log(`patterns: ${manifest.patterns.join(', ') || 'none'}`);
  } finally {
    await client.close();
  }
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}`) {
  main().catch(error => {
    console.error(error.message);
    process.exit(1);
  });
}
