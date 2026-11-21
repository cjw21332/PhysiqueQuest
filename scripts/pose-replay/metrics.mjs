export const quantile = (values, p) => values.length ? [...values].sort((a, b) => a - b)[Math.max(0, Math.ceil(p * values.length) - 1)] : null;

export function scoreReplay(summary, labels) {
  const accepted = labels?.reviewStatus === 'reviewed' && labels.reviewedBy && Array.isArray(labels.sets) && labels.sets.length > 0;
  const sets = accepted ? labels.sets.map(set => {
    const events = summary.repEvents.filter(event => event.timestampMs >= set.startMs && event.timestampMs <= set.endMs);
    const detectedFull = events.filter(event => event.type === 'full').length;
    const detectedPartial = events.filter(event => event.type === 'partial').length;
    const full = Number.isSafeInteger(set.fullReps) && set.fullReps >= 0;
    const partial = Number.isSafeInteger(set.partialReps) && set.partialReps >= 0;
    return { id: set.id, detectedFull, detectedPartial, fullError: full ? detectedFull - set.fullReps : null, partialError: partial ? detectedPartial - set.partialReps : null };
  }) : null;
  // A cue is false only when a human has reviewed that exact rule/time interval.
  const reviewedCues = accepted && labels.cueCoverageComplete === true ? summary.cueEvents.map(cue => {
    const annotations = labels.formIntervals?.filter(interval => interval.rule === cue.rule && cue.timestampMs >= interval.startMs && cue.timestampMs <= interval.endMs) ?? [];
    return annotations.length === 1 && typeof annotations[0].faultPresent === 'boolean' ? { ...cue, falseCue: !annotations[0].faultPresent } : null;
  }) : null;
  const complete = reviewedCues !== null && reviewedCues.every(Boolean);
  const falseCues = complete ? reviewedCues.filter(cue => cue.falseCue).length : null;
  return { status: accepted ? 'labels-reviewed' : 'unscored-missing-reviewed-labels', sets,
    falseCueCount: falseCues, falseCueRatePerMinute: falseCues === null ? null : falseCues / (summary.durationMs / 60000),
    note: 'Counts, camera facing and correctness are never inferred from filenames or model output.' };
}

export function memoryTrend(samples, warmupMs = 300000) {
  const points = samples.filter(sample => sample.elapsedMs >= warmupMs && Number.isFinite(sample.jsHeapBytes));
  if (points.length < 2) return { growthMiB: null, slopeMiBPerMinute: null, samples: points.length };
  const x = points.map(p => p.elapsedMs / 60000), y = points.map(p => p.jsHeapBytes / 1048576);
  const mx = x.reduce((a,b) => a+b,0)/x.length, my = y.reduce((a,b) => a+b,0)/y.length;
  const variance = x.reduce((sum,v) => sum+(v-mx)**2,0);
  return { growthMiB: y.at(-1)-y[0], slopeMiBPerMinute: variance ? x.reduce((sum,v,i) => sum+(v-mx)*(y[i]-my),0)/variance : null, samples: points.length };
}
