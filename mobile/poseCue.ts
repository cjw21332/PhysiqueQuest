export type PoseCue = { id: string; message: string; priority: 'alignment' | 'depth' | 'tempo' };
import { CUE_PRIORITY, POSE_CUE_TIMING } from '../shared/poseConfig';
export { POSE_CUE_TIMING } from '../shared/poseConfig';

export function createPoseCueController() {
  let current: PoseCue | null = null, shownAt = 0;
  const spoken = new Map<string, number>();
  return {
    update(now: number, candidates: readonly PoseCue[], muted = false) {
      const next = [...candidates].sort((a, b) => CUE_PRIORITY[b.priority] - CUE_PRIORITY[a.priority])[0] ?? null;
      if (!current || (next && CUE_PRIORITY[next.priority] > CUE_PRIORITY[current.priority]) || (now - shownAt >= POSE_CUE_TIMING.minimumDisplayMs && next?.id !== current.id)) {
        current = next;
        shownAt = now;
      }
      const speak = current !== null && candidates.some(candidate => candidate.id === current!.id) && !muted && now - (spoken.get(current.id) ?? -Infinity) >= POSE_CUE_TIMING.repeatSpeechMs;
      if (speak && current) spoken.set(current.id, now);
      return { cue: current, speak };
    },
  };
}
