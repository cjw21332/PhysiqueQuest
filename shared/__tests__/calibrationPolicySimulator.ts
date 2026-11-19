/** Experimental test-only policy model. Inputs are angles, not camera measurements. */
export type Endpoints = { start: number; peak: number };
export type Outcome = 'completed_full' | 'completed_partial' | 'interrupted';
export class CalibrationPolicySimulator {
  active: Endpoints;
  pending: Endpoints | null = null;
  frozen: Endpoints | null = null;
  state: 'start' | 'moving' | 'peak' | 'lost' = 'start';
  outcomes: Outcome[] = [];
  constructor(initial: Endpoints, readonly minimumSpan: number) { this.active = { ...initial }; }
  propose(candidate: Endpoints): boolean {
    if (!Number.isFinite(candidate.start) || !Number.isFinite(candidate.peak) || candidate.start > 180 || candidate.start < 0 || candidate.peak < 0 || candidate.peak > 180 || candidate.start - candidate.peak < this.minimumSpan) { this.pending = null; return false; }
    this.pending = { ...candidate }; return true;
  }
  update(angle: number | null): void {
    if (angle === null) {
      if (this.frozen) this.outcomes.push('interrupted');
      this.state = 'lost'; this.frozen = null; this.pending = null; return;
    }
    if (this.state === 'lost') { if (angle >= this.active.start - 2) this.state = 'start'; return; }
    const e = this.frozen ?? this.active;
    const p = (e.start - angle) / (e.start - e.peak);
    if (this.state === 'start') { if (p > 0.2) { this.frozen = { ...this.active }; this.state = 'moving'; } return; }
    if (this.state === 'moving' && p >= 0.85) { this.state = 'peak'; return; }
    if (this.state === 'peak' && p <= 0.1) {
      this.outcomes.push('completed_full'); this.state = 'start'; this.frozen = null;
      if (this.pending) { this.active = this.pending; this.pending = null; }
    }
  }
}
