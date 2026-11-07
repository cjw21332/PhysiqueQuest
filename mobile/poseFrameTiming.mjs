// Keep only fresh observations and never queue overlapping camera frames.
export const MAX_POSE_AGE_MS = 1500;
export const TARGET_FRAME_INTERVAL_MS = 100;
export function nextFrameDelay(capturedAt, now) {
  if (!Number.isFinite(capturedAt) || !Number.isFinite(now)) return TARGET_FRAME_INTERVAL_MS;
  return Math.max(0, TARGET_FRAME_INTERVAL_MS - Math.max(0, now - capturedAt));
}
export function poseIsFresh(capturedAt, now) {
  return Number.isFinite(capturedAt) && Number.isFinite(now) && now >= capturedAt && now - capturedAt <= MAX_POSE_AGE_MS;
}
