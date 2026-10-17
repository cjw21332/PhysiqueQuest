/**
 * One shared alarm sound for the whole app.
 *
 * Mobile browsers and the Expo WebView only let audio start after a user gesture.
 * `primeAlarmAudio` must be called inside the "Start workout" tap so the context is
 * created and unlocked there; `startAlarm` later just raises the gain.
 */
type Engine = { ctx: AudioContext; gain: GainNode };
let engine: Engine | null = null;

export function primeAlarmAudio(): void {
  if (engine || typeof AudioContext === 'undefined') return;
  const ctx = new AudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'square';
  osc.frequency.value = 880;
  gain.gain.value = 0;
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  engine = { ctx, gain };
}

export function startAlarm(maximum = true): void {
  if (!engine) return;
  void engine.ctx.resume();
  engine.gain.gain.value = maximum ? 0.6 : 0.25;
}

export function stopAlarm(): void {
  if (engine) engine.gain.gain.value = 0;
}
