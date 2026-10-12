export const COUNTDOWN_MS = 30_000;

/**
 * Inactivity state machine.
 *
 * MONITORING --(no movement for thresholdMs)--> COUNTDOWN
 * COUNTDOWN  --(movement or "I'm okay")-------> MONITORING   (emits cancelled)
 * COUNTDOWN  --(30 s elapsed)-----------------> ALARM        (emits alarm)
 * ALARM      --(hold-stop)------------------> STOPPED      (emits stopped)
 *
 * Pure: no timers, no React, no native imports. The host calls `tick(now)` and
 * `movement(now)` and reads back the emitted events.
 */
export function createInactivityMachine({ thresholdMs }) {
  if (!Number.isFinite(thresholdMs) || thresholdMs <= 0) throw new Error('thresholdMs must be a positive number');
  let state = 'MONITORING';
  let lastMovementAt = null;
  let countdownStartedAt = null;
  const events = [];

  const emit = (event) => events.push(event);

  return {
    get state() { return state; },

    /** Starts monitoring from `now`. Movement is measured from this point. */
    start(now) {
      state = 'MONITORING';
      lastMovementAt = now;
      countdownStartedAt = null;
    },

    movement(now) {
      if (state === 'MONITORING') {
        lastMovementAt = now;
        return;
      }
      if (state === 'COUNTDOWN') {
        state = 'MONITORING';
        countdownStartedAt = null;
        lastMovementAt = now;
        emit({ type: 'cancelled', reason: 'movement' });
      }
    },

    imOkay(now) {
      if (state !== 'COUNTDOWN') return;
      state = 'MONITORING';
      countdownStartedAt = null;
      lastMovementAt = now;
      emit({ type: 'cancelled', reason: 'im-okay' });
    },

    tick(now) {
      if (state === 'MONITORING' && lastMovementAt !== null && now - lastMovementAt >= thresholdMs) {
        state = 'COUNTDOWN';
        countdownStartedAt = now;
        emit({ type: 'countdown-started', seconds: COUNTDOWN_MS / 1000 });
        return;
      }
      if (state === 'COUNTDOWN' && now - countdownStartedAt >= COUNTDOWN_MS) {
        state = 'ALARM';
        emit({ type: 'alarm' });
      }
    },

    holdStop() {
      if (state !== 'ALARM') return;
      state = 'STOPPED';
      emit({ type: 'stopped' });
    },

    /** Returns and clears events emitted since the last call. */
    drain() {
      return events.splice(0, events.length);
    },
  };
}
