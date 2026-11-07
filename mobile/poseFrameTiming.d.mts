export const MAX_POSE_AGE_MS: number;
export const TARGET_FRAME_INTERVAL_MS: number;
export function nextFrameDelay(capturedAt: number, now: number): number;
export function poseIsFresh(capturedAt: number, now: number): boolean;
