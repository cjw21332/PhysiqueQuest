/**
 * Generic Angle-Based Rep Counter
 * 
 * Pure TypeScript, framework-free implementation for counting reps
 * using exercise-specific angle configurations derived from GIF analysis.
 * 
 * This is the runtime counterpart to the Python offline pipeline.
 * Angle math must match Python implementation exactly (see tests/parity).
 */

export type JointAngleConfig = {
  joint: string;              // e.g., "left_knee", "right_elbow"
  startAngle: number;         // degrees
  peakAngle: number;          // degrees
  direction: 'increasing' | 'decreasing';
  referenceRange: number;     // |start - peak|
};

export type StabilityConstraint = {
  joint: string;
  meanAngle: number;
  tolerance: number;
};

export type GeneratedAngleConfig = {
  primaryJoints: string[];           // joint names from config
  sideMode: 'bilateral' | 'unilateral' | 'alternating' | 'unknown';
  startAngles: Record<string, number>;
  peakAngles: Record<string, number>;
  directions: Record<string, 'increasing' | 'decreasing'>;
  referenceRanges: Record<string, number>;
  stabilityConstraints: StabilityConstraint[];
  viewHint: 'front' | 'side' | 'unknown';
};

/** Input landmark per frame (matches MediaPipe 33 landmarks) */
export type Landmark = {
  x: number;
  y: number;
  z: number;
  visibility: number;
  presence: number;
};

/** Input frame with landmarks and metadata */
export type PoseFrame = {
  landmarks: Landmark[];      // 33 landmarks
  timestamp: number;          // ms
  aspect: number;             // width / height
};

/** Counter state */
export type CounterState = 
  | 'AT_START'    // At start angle, waiting for movement
  | 'MOVING'      // Moving away from start toward peak
  | 'AT_PEAK'     // Reached peak, waiting for return
  | 'RETURNING'   // Returning toward start
  | 'VISIBILITY_LOST'; // Primary joints not visible

/** Counter events */
export type CounterEvent = 
  | { type: 'rep_counted'; count: number; joint: string; durationMs: number }
  | { type: 'rep_partial'; progress: number; joint: string; cue: string }
  | { type: 'rep_rejected_fault'; joint: string; faultJoint: string; cue: string }
  | { type: 'visibility_lost'; joint: string }
  | { type: 'visibility_restored'; joint: string }
  | { type: 'state_change'; from: CounterState; to: CounterState };

/** Live progress info */
export type ProgressInfo = {
  state: CounterState;
  repCount: number;
  partialCount: number;
  currentProgress: number;      // 0-1 normalized progress in current rep
  currentAngle: number | null;  // primary joint angle
  currentJoint: string | null;  // which joint being tracked
  cue: string | null;           // current cue message
  faults: string[];             // active fault messages
};

/** Configuration for counter behavior (can be overridden per exercise) */
export type CounterConfig = {
  fullRangeThreshold: number;       // default 0.85 - must reach this progress to count
  startTolerance: number;           // default 0.2 - return within this of start (normalized)
  minRepDurationMs: number;         // default 400
  maxRepDurationMs: number;         // default 10000
  faultMinMs: number;               // default 250 - fault must persist this long to reject
  visibilityThreshold: number;      // default 0.5 - landmark visibility
  visibilityLostMaxMs: number;      // default 500 - pause counting after this
  emaAlpha: number;                 // default 0.35 - EMA smoothing (0-1)
};

/** Default configuration */
export const DEFAULT_COUNTER_CONFIG: CounterConfig = {
  fullRangeThreshold: 0.85,
  startTolerance: 0.2,
  minRepDurationMs: 400,
  maxRepDurationMs: 10000,
  faultMinMs: 250,
  visibilityThreshold: 0.5,
  visibilityLostMaxMs: 500,
  emaAlpha: 0.35,
};

/** Device tier detection based on user agent and device capabilities */
export function detectDeviceTier(): 'low' | 'medium' | 'high' {
  if (typeof navigator === 'undefined') return 'medium';

  const ua = navigator.userAgent || '';
  const platform = navigator.platform || '';

  // iOS devices - classify as medium (generally good performance)
  if (/iPhone|iPad|iPod/.test(ua) || platform === 'iOS') {
    // Check for low-end iOS devices (older models)
    if (/cpu iphone os [1-5]_[0-9_]+ like mac os x/.test(ua) || /Like Mac OS X/.test(ua)) {
      // Very old iOS versions - classify as low
      return 'low';
    }
    return 'medium'; // Most iOS devices perform well
  }

  // Android low-end devices detection
  if (/Android/.test(ua)) {
    // Check for known low-end model numbers
    const lowEndModels = [
      'GT-I1999', 'SM-G3815', 'SM-G381', 'SM-G380', 'WT8804',
      'GT-I8262', 'SM-G355', 'SM-G350', 'SM-G350H', 'SM-G350F',
      'SM-G350F', 'SM-J1', 'SM-J1mini', 'SM-J1Ace', 'SM-J1miniF',
      'SM-J1', 'SM-J1mini'
    ];
    if (ua.match(/SM-G[0-9]{4}|GT-I[0-9]{4}|SM-J[0-9]/)) {
      // Check if it's a known low-end model
      for (const model of lowEndModels) {
        if (ua.includes(model)) return 'low';
      }
    }
    // Default Android classification
    return 'medium';
  }

  // Desktop/other devices - medium performance
  return 'medium';
}

/** Get the configuration for a specific device tier */
export function getDeviceTierConfig(tier: 'low' | 'medium' | 'high') {
  return MOBILE_CONFIG.TIERS[tier] || MOBILE_CONFIG.TIERS.medium;
}

/** Get the frame interval (ms per frame) for a device tier */
export function getFrameIntervalMs(tier: 'low' | 'medium' | 'high'): number {
  return MOBILE_CONFIG.FRAME_INTERVALS[tier] || MOBILE_CONFIG.FRAME_INTERVALS.medium;
}

/** Get the full range threshold for a device tier */
export function getStartAngleThreshold(tier: 'low' | 'medium' | 'high'): number {
  return MOBILE_CONFIG.TIERS[tier].fullRangeThreshold;
}

/** Get the start tolerance for a device tier */
export function getStartTolerance(tier: 'low' | 'medium' | 'high'): number {
  return MOBILE_CONFIG.TIERS[tier].startTolerance;
}

// Device tier and performance configuration based on device capabilities
// These thresholds are STARTING GUESSES to be tuned with real device data
export const MOBILE_CONFIG = {
  // Device tiers based on performance characteristics
  TIERS: {
    low: {
      maxFPS: 5,              // 5 FPS - acceptable for tracking on low-end
      fullRangeThreshold: 0.9, // More conservative angle range
      startTolerance: 0.3,   // More tolerant of partial reps
      minBattery: 0.3,       // 30% battery minimum before reduction
      description: 'Low-end Android devices, older iPhones'
    },
    medium: {
      maxFPS: 10,             // 10 FPS - standard performance
      fullRangeThreshold: 0.85,
      startTolerance: 0.2,
      minBattery: 0.2, // 20% battery minimum
      description: 'Mid-range phones (most common)'
    },
    high: {
      maxFPS: 15,             // 15 FPS - smoother performance
      fullRangeThreshold: 0.8,
      startTolerance: 0.15,
      minBattery: 0.1, // 10% battery minimum
      description: 'High-end flagship phones'
    }
  },

  // Default configuration to use if device tier detection fails
  defaultTier: 'medium' as const,

  // Frame interval thresholds (ms per frame)
  FRAME_INTERVALS: {
    low: 200,     // 5 FPS (200ms per frame)
    medium: 100,  // 10 FPS (100ms per frame)
    high: 50,     // 20 FPS (50ms per frame)
  },

  // Battery awareness thresholds
  BATTERY_LOW: 0.2,     // 20% battery - start reducing performance
  BATTERY_CRITICAL: 0.1, // 10% battery - maximum reduction
  BATTERY_RECOVERY_MS: 30000, // 30 seconds to consider battery recovery
};

/** Main counter class */
export class GenericRepCounter {
  private config: CounterConfig;
  private genConfig: GeneratedAngleConfig;
  private jointIndices: Record<string, number>;  // joint name -> MediaPipe index
  
  // State
  private state: CounterState = 'AT_START';
  private repCount = 0;
  private partialCount = 0;
  private currentRepStartMs = 0;
  private currentPeakMs = 0;
  private maxProgressInRep = 0;
  private emaAngle: number | null = null;
  private lastAngle: number | null = null;
  private lastTimestamp: number | null = null;
  private visibilityLostMs: number | null = null;
  private faultStartMs: Record<string, number> = {};
  private activeFaults: Set<string> = new Set();
  
  // Callbacks
  private onEvent?: (event: CounterEvent) => void;
  private onProgress?: (progress: ProgressInfo) => void;

  constructor(genConfig: GeneratedAngleConfig, config: Partial<CounterConfig> = {}) {
    this.genConfig = genConfig;
    this.config = { ...DEFAULT_COUNTER_CONFIG, ...config };
    this.jointIndices = this.buildJointIndices();
  }

  /** MediaPipe landmark indices for each joint */
  private buildJointIndices(): Record<string, number> {
    // MediaPipe Pose 33 landmarks
    const indices: Record<string, number> = {
      // Left side
      left_shoulder: 11,
      left_elbow: 13,
      left_wrist: 15,
      left_hip: 23,
      left_knee: 25,
      left_ankle: 27,
      // Right side
      right_shoulder: 12,
      right_elbow: 14,
      right_wrist: 16,
      right_hip: 24,
      right_knee: 26,
      right_ankle: 28,
    };
    return indices;
  }

  /** Set event callback */
  setEventCallback(cb: (event: CounterEvent) => void): void {
    this.onEvent = cb;
  }

  /** Set progress callback */
  setProgressCallback(cb: (progress: ProgressInfo) => void): void {
    this.onProgress = cb;
  }

  /** Get current progress info */
  getProgress(): ProgressInfo {
    return {
      state: this.state,
      repCount: this.repCount,
      partialCount: this.partialCount,
      currentProgress: this.computeProgress(),
      currentAngle: this.emaAngle,
      currentJoint: this.getPrimaryJoint(),
      cue: this.getCue(),
      faults: Array.from(this.activeFaults),
    };
  }

  /** Reset counter to initial state */
  reset(): void {
    this.resetSession();
  }

  resetSession(): void {
    this.resetMotion();
    this.repCount = 0;
    this.partialCount = 0;
    this.lastTimestamp = null;
    this.visibilityLostMs = null;
    this.emitProgress();
  }

  private resetMotion(): void {
    this.state = 'AT_START';
    this.currentRepStartMs = 0;
    this.currentPeakMs = 0;
    this.maxProgressInRep = 0;
    this.emaAngle = null;
    this.lastAngle = null;
    this.faultStartMs = {};
    this.activeFaults.clear();
  }

  /** Process a single pose frame */
  /** Host must call this using the same monotonic clock as frame timestamps. */
  tick(now: number): ProgressInfo {
    if (this.lastTimestamp === null || !Number.isFinite(now) || now <= this.lastTimestamp) return this.getProgress();
    if (this.visibilityLostMs === null) this.visibilityLostMs = this.lastTimestamp;
    if (now - this.visibilityLostMs > this.config.visibilityLostMaxMs && this.state !== 'VISIBILITY_LOST') {
      this.state = 'VISIBILITY_LOST';
      this.emitEvent({ type: 'visibility_lost', joint: this.getPrimaryJoint() });
      this.emitProgress();
    }
    return this.getProgress();
  }

  update(frame: PoseFrame): ProgressInfo {
    const { landmarks, timestamp, aspect } = frame;

    // Validate timestamp
    if (!Number.isFinite(timestamp) || (this.lastTimestamp !== null && timestamp <= this.lastTimestamp)) {
      return this.getProgress();
    }

    // Check for large time gap (reset motion)
    if (this.lastTimestamp !== null && timestamp - this.lastTimestamp > this.config.maxRepDurationMs) {
      this.resetMotion();
      this.visibilityLostMs = null;
    }
    this.lastTimestamp = timestamp;

    // Compute primary joint angle
    const primaryJoint = this.getPrimaryJoint();
    const angle = this.computeJointAngle(landmarks, primaryJoint, aspect);

    if (angle === null) {
      // Visibility lost
      this.handleVisibilityLost(primaryJoint, timestamp);
      return this.getProgress();
    }

    // Visibility restored
    if (this.visibilityLostMs !== null) {
      if (this.state === 'VISIBILITY_LOST' || timestamp - this.visibilityLostMs > this.config.visibilityLostMaxMs) {
        if (this.state !== 'VISIBILITY_LOST') this.emitEvent({ type: 'visibility_lost', joint: primaryJoint });
        this.resetMotion();
        this.emitEvent({ type: 'visibility_restored', joint: primaryJoint });
      }
      this.visibilityLostMs = null;
    }

    // EMA smoothing
    if (this.emaAngle === null) {
      this.emaAngle = angle;
    } else {
      this.emaAngle = this.emaAngle * (1 - this.config.emaAlpha) + angle * this.config.emaAlpha;
    }

    // Compute normalized progress
    const progress = this.computeNormalizedProgress(this.emaAngle, primaryJoint);

    // Check stability constraints
    this.checkStabilityConstraints(landmarks, aspect, timestamp);

    // State machine
    this.updateStateMachine(progress, primaryJoint, timestamp);

    this.lastAngle = angle;
    this.emitProgress();
    return this.getProgress();
  }

  /** Get the primary joint to track (first in primaryJoints with valid config) */
  private getPrimaryJoint(): string {
    // For bilateral, average both sides; for now use first valid
    for (const joint of this.genConfig.primaryJoints) {
      if (this.genConfig.startAngles[joint] !== undefined && 
          this.genConfig.peakAngles[joint] !== undefined) {
        return joint;
      }
    }
    return this.genConfig.primaryJoints[0] || 'left_knee';
  }

  /** Compute 2D joint angle with aspect correction (matches Python) */
  private computeJointAngle(landmarks: Landmark[], joint: string, aspect: number): number | null {
    const jointDefs: Record<string, [number, number, number]> = {
      left_elbow: [11, 13, 15],
      right_elbow: [12, 14, 16],
      left_shoulder: [23, 11, 13],
      right_shoulder: [24, 12, 14],
      left_hip: [11, 23, 25],
      right_hip: [12, 24, 26],
      left_knee: [23, 25, 27],
      right_knee: [24, 26, 28],
      left_ankle: [25, 27, 31],
      right_ankle: [26, 28, 32],
    };

    const indices = jointDefs[joint];
    if (!indices) return null;

    const [aIdx, bIdx, cIdx] = indices;
    if (landmarks.length < 33) return null;

    const a = landmarks[aIdx];
    const b = landmarks[bIdx];
    const c = landmarks[cIdx];

    const visThreshold = this.config.visibilityThreshold;
    if (a.visibility < visThreshold || b.visibility < visThreshold || c.visibility < visThreshold) {
      return null;
    }

    // Aspect-corrected 2D angle (matches Python compute_angle_2d)
    const ax = (a.x - b.x) * aspect;
    const ay = a.y - b.y;
    const cx = (c.x - b.x) * aspect;
    const cy = c.y - b.y;

    const normA = Math.hypot(ax, ay);
    const normC = Math.hypot(cx, cy);
    if (normA < 1e-6 || normC < 1e-6) return null;

    const dot = ax * cx + ay * cy;
    const cosAngle = Math.max(-1, Math.min(1, dot / (normA * normC)));
    return Math.acos(cosAngle) * 180 / Math.PI;
  }

  /** Compute normalized progress 0-1 (matches Python) */
  private computeNormalizedProgress(angle: number, joint: string): number {
    const start = this.genConfig.startAngles[joint];
    const peak = this.genConfig.peakAngles[joint];
    if (start === undefined || peak === undefined) return 0;

    const refRange = Math.abs(peak - start);
    if (refRange < 1) return 0;

    return (angle - start) / (peak - start);
  }

  /** Compute raw progress for display */
  private computeProgress(): number {
    if (this.emaAngle === null) return 0;
    const joint = this.getPrimaryJoint();
    return Math.max(0, Math.min(1, this.computeNormalizedProgress(this.emaAngle, joint)));
  }

  /** Check stability constraints (fault detection) */
  private checkStabilityConstraints(landmarks: Landmark[], aspect: number, timestamp: number): void {
    for (const constraint of this.genConfig.stabilityConstraints) {
      const angle = this.computeJointAngle(landmarks, constraint.joint, aspect);
      if (angle === null) continue;

      const deviation = Math.abs(angle - constraint.meanAngle);
      const isFault = deviation > constraint.tolerance;

      if (isFault) {
        if (!this.faultStartMs[constraint.joint]) {
          this.faultStartMs[constraint.joint] = timestamp;
        } else if (timestamp - this.faultStartMs[constraint.joint] >= this.config.faultMinMs) {
          if (!this.activeFaults.has(constraint.joint)) {
            this.activeFaults.add(constraint.joint);
            this.emitEvent({
              type: 'rep_rejected_fault',
              joint: this.getPrimaryJoint(),
              faultJoint: constraint.joint,
              cue: `Keep your ${constraint.joint.replace('_', ' ')} stable`
            });
          }
        }
      } else {
        if (this.faultStartMs[constraint.joint]) {
          delete this.faultStartMs[constraint.joint];
        }
        this.activeFaults.delete(constraint.joint);
      }
    }
  }

  /** Handle visibility loss */
  private handleVisibilityLost(joint: string, timestamp: number): void {
    if (this.visibilityLostMs === null) {
      this.visibilityLostMs = timestamp;
    } else if (timestamp - this.visibilityLostMs > this.config.visibilityLostMaxMs && this.state !== 'VISIBILITY_LOST') {
      this.state = 'VISIBILITY_LOST';
      this.emitEvent({ type: 'visibility_lost', joint });
    }
  }

  /** State machine for rep counting */
  private updateStateMachine(progress: number, joint: string, timestamp: number): void {
    const fullThreshold = this.config.fullRangeThreshold;
    const startTol = this.config.startTolerance;

    switch (this.state) {
      case 'AT_START':
        if (progress > 0.05) { // Left start zone
          this.state = 'MOVING';
          this.currentRepStartMs = timestamp;
          this.emitEvent({ type: 'state_change', from: 'AT_START', to: 'MOVING' });
        }
        break;

      case 'MOVING':
        this.maxProgressInRep = Math.max(this.maxProgressInRep, progress);
        if (progress >= fullThreshold) {
          this.state = 'AT_PEAK';
          this.currentPeakMs = timestamp;
          this.emitEvent({ type: 'state_change', from: 'MOVING', to: 'AT_PEAK' });
        } else if (progress <= startTol) {
          // Returned to start without reaching peak - partial
          if (this.maxProgressInRep > 0.4) { // Minimum progress for partial
            this.partialCount++;
            this.emitEvent({
              type: 'rep_partial',
              progress: this.maxProgressInRep,
              joint,
              cue: this.getPartialCue(joint, this.maxProgressInRep)
            });
          }
          this.state = 'AT_START';
          this.maxProgressInRep = 0;
          this.emitEvent({ type: 'state_change', from: 'MOVING', to: 'AT_START' });
        }
        break;

      case 'AT_PEAK':
        if (progress <= startTol) {
          // Completed rep!
          const duration = timestamp - this.currentRepStartMs;
          if (duration >= this.config.minRepDurationMs && duration <= this.config.maxRepDurationMs) {
            if (this.activeFaults.size === 0) {
              this.repCount++;
              this.emitEvent({
                type: 'rep_counted',
                count: this.repCount,
                joint,
                durationMs: duration
              });
            } else {
              // Fault already emitted during AT_PEAK
            }
          }
          this.state = 'AT_START';
          this.currentRepStartMs = 0;
          this.currentPeakMs = 0;
          this.emitEvent({ type: 'state_change', from: 'AT_PEAK', to: 'AT_START' });
        }
        break;

      case 'VISIBILITY_LOST':
        // Wait for visibility restore
        break;
    }
  }

  /** Get cue message for partial rep */
  private getPartialCue(joint: string, progress: number): string {
    const dir = this.genConfig.directions[joint];
    if (dir === 'increasing') {
      return 'Go deeper - extend further';
    } else {
      return 'Go deeper - bend more';
    }
  }

  /** Get current cue */
  private getCue(): string | null {
    if (this.state === 'VISIBILITY_LOST') {
      return 'Move so your whole body is visible';
    }
    if (this.activeFaults.size > 0) {
      return Array.from(this.activeFaults)[0];
    }
    if (this.state === 'AT_START') {
      return 'Ready - begin movement';
    }
    if (this.state === 'MOVING') {
      return 'Continue to full range';
    }
    if (this.state === 'AT_PEAK') {
      return 'Return to start position';
    }
    return null;
  }

  /** Emit event to callback */
  private emitEvent(event: CounterEvent): void {
    if (this.onEvent) this.onEvent(event);
  }

  /** Emit progress to callback */
  private emitProgress(): void {
    if (this.onProgress) this.onProgress(this.getProgress());
  }
}

/** Factory function for creating counter from generated config */
export function createGenericRepCounter(
  genConfig: GeneratedAngleConfig,
  config?: Partial<CounterConfig>
): GenericRepCounter {
  return new GenericRepCounter(genConfig, config);
}

/** Utility: Convert backend TrackingConfig to GeneratedAngleConfig */
export function trackingConfigToGeneratedAngle(config: any): GeneratedAngleConfig | null {
  if (config.trackingMode !== 'generated-angle' || !config.generatedAngleConfig) {
    return null;
  }
  const g = config.generatedAngleConfig;
  return {
    primaryJoints: g.primaryJoints,
    sideMode: g.sideMode,
    startAngles: g.startAngles,
    peakAngles: g.peakAngles,
    directions: g.directions,
    referenceRanges: g.referenceRanges,
    stabilityConstraints: g.stabilityConstraints,
    viewHint: g.viewHint,
  };
}
