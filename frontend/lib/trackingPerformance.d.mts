export type BatteryReading = { level: number; charging: boolean };
export function trackingFrameInterval(inferenceMs: number, battery: BatteryReading | null): number;
export function trackingPowerNotice(battery: BatteryReading | null): string;
