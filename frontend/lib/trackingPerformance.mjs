// These conservative scheduling thresholds are experimental, not thermal measurements.
export function trackingFrameInterval(inferenceMs, battery) {
  const inference = Number.isFinite(inferenceMs) && inferenceMs >= 0 ? inferenceMs : 0;
  const minimum = battery && battery.charging === false && Number.isFinite(battery.level) && battery.level >= 0 && battery.level <= 1
    ? battery.level <= 0.1 ? 500 : battery.level <= 0.2 ? 250 : 100
    : 100;
  return Math.max(minimum, Math.min(500, inference * 2));
}

export function trackingPowerNotice(battery) {
  if (!battery || typeof battery.charging !== 'boolean' || !Number.isFinite(battery.level) || battery.level < 0 || battery.level > 1) return 'Battery status unavailable on this device.';
  if (!battery.charging && battery.level <= 0.1) return 'Low battery: tracking updates are reduced.';
  if (!battery.charging && battery.level <= 0.2) return 'Battery is low: tracking updates are reduced.';
  return '';
}
