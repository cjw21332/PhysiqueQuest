export type PoseSegment = readonly [number, number];
type Point = { x: number; y: number; visibility?: number } | undefined;

/** Keep each last-seen bone briefly when only some landmarks flicker. */
export function createStablePoseSegments(bones: readonly PoseSegment[], visibility: number, holdMs: number) {
  const last = new Map<number, { path: string; seen: number }>();
  return {
    reset() { last.clear(); },
    update(points: readonly Point[], timestamp: number) {
      return bones.map(([a, b], index) => {
        const first = points[a], second = points[b];
        if (first && second && Number.isFinite(first.x) && Number.isFinite(first.y) && Number.isFinite(second.x) && Number.isFinite(second.y)
          && (first.visibility ?? 1) >= visibility && (second.visibility ?? 1) >= visibility) {
          const path = `M${first.x},${first.y}L${second.x},${second.y}`;
          last.set(index, { path, seen: timestamp });
          return path;
        }
        const previous = last.get(index);
        if (previous && timestamp >= previous.seen && timestamp - previous.seen <= holdMs) return previous.path;
        last.delete(index);
        return '';
      });
    },
  };
}
