export type ReadinessCheck = {
  status: 'ready' | 'adjust' | 'unknown';
  label: string;
};

export type CameraReadiness = {
  fullBody: ReadinessCheck;
  lighting: ReadinessCheck;
  distance: ReadinessCheck;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function findValue(record: Record<string, unknown>, names: string[]): unknown {
  for (const name of names) {
    if (name in record) return record[name];
  }
  return undefined;
}

function findCheckValue(analysis: unknown, names: string[]): unknown {
  const root = asRecord(analysis);
  if (!root) return undefined;
  const records = [root, asRecord(root.readiness), asRecord(root.checks), asRecord(root.cameraReadiness)];
  for (const record of records) {
    if (!record) continue;
    const value = findValue(record, names);
    if (value !== undefined) return value;
  }
  return undefined;
}

function truthState(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value > 0.5;
  const record = asRecord(value);
  if (record) {
    const nested = findValue(record, ['ready', 'detected', 'inFrame', 'in_frame', 'sufficient', 'inRange', 'in_range', 'ok']);
    if (nested !== undefined) return truthState(nested);
    value = findValue(record, ['status', 'result', 'label', 'assessment']);
  }
  if (typeof value !== 'string') return null;
  const text = value.toLowerCase().replace(/[_-]+/g, ' ');
  if (/\b(not detected|not visible|outside|out of frame|insufficient|too (?:near|far)|adjust|failed|no)\b/.test(text)) return false;
  if (/\b(detected|visible|in frame|full body|sufficient|good|ready|in range|optimal|pass|yes)\b/.test(text)) return true;
  return null;
}

function checkFrom(value: unknown, good: string, adjust: string): ReadinessCheck {
  const state = truthState(value);
  if (state === true) return { status: 'ready', label: good };
  if (state === false) return { status: 'adjust', label: adjust };
  return { status: 'unknown', label: 'Not assessed' };
}

function distanceCheck(value: unknown): ReadinessCheck {
  const record = asRecord(value);
  const metersValue = typeof value === 'number'
    ? value
    : record ? findValue(record, ['meters', 'distanceMeters', 'distance_m']) : undefined;
  if (typeof metersValue === 'number' && Number.isFinite(metersValue) && metersValue > 0) {
    const inRange = metersValue >= 2.5 && metersValue <= 3;
    return {
      status: inRange ? 'ready' : 'adjust',
      label: `${metersValue.toFixed(1)} m · ${inRange ? 'in range' : metersValue < 2.5 ? 'move back' : 'move closer'}`,
    };
  }
  const state = truthState(value);
  if (state === true) return { status: 'ready', label: 'In range' };
  if (state === false) {
    const label = record ? findValue(record, ['status', 'result', 'label', 'assessment']) : value;
    return { status: 'adjust', label: typeof label === 'string' ? label : 'Adjust distance' };
  }
  return { status: 'unknown', label: 'Not assessed' };
}

export function parseCameraReadiness(analysis: unknown): CameraReadiness {
  return {
    fullBody: checkFrom(
      findCheckValue(analysis, ['fullBodyInFrame', 'full_body_in_frame', 'bodyInFrame', 'body_in_frame']),
      'Detected',
      'Move into frame',
    ),
    lighting: checkFrom(
      findCheckValue(analysis, ['lighting', 'lightingSufficient', 'lighting_sufficient']),
      'Sufficient',
      'Improve lighting',
    ),
    distance: distanceCheck(findCheckValue(analysis, ['distance', 'distanceInRange', 'distance_in_range'])),
  };
}

export function readyCheckCount(readiness: CameraReadiness | null, cameraReady: boolean): number {
  if (!cameraReady) return 0;
  if (!readiness) return 1;
  return 1 + [readiness.fullBody, readiness.lighting, readiness.distance]
    .filter(check => check.status === 'ready').length;
}
