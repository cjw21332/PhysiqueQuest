/** Movement threshold in g: a change in acceleration magnitude above this counts as movement. */
export const MOVEMENT_DELTA_G = 0.08;

/**
 * Turns raw accelerometer samples into "movement happened" decisions.
 * Compares the magnitude of each sample with the previous one, so gravity alone is ignored.
 */
export function createMovementDetector({ deltaG = MOVEMENT_DELTA_G } = {}) {
  let previous = null;
  return {
    /** Returns true when this sample shows movement relative to the previous one. */
    sample({ x, y, z }) {
      const magnitude = Math.sqrt(x * x + y * y + z * z);
      if (previous === null) {
        previous = magnitude;
        return false;
      }
      const moved = Math.abs(magnitude - previous) > deltaG;
      previous = magnitude;
      return moved;
    },
    reset() {
      previous = null;
    },
  };
}
