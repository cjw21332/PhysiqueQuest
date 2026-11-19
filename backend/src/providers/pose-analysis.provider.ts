import { outboundFetch } from '../common/outbound.js';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

@Injectable()
export class PoseAnalysisProvider {
  private localStartup?: Promise<void>;
  constructor(private readonly config: ConfigService) {}
  isAvailable() { return Boolean(this.config.get<string>('POSE_ANALYSIS_URL') && this.config.get<string>('POSE_ANALYSIS_API_KEY')); }
  private async recoverLocalProvider(endpoint: string) {
    if (process.env.NODE_ENV === 'production' || endpoint !== 'http://127.0.0.1:8000/analyze') return;
    if (!this.localStartup) {
      this.localStartup = new Promise<void>((done) => {
        const child = spawn(process.execPath, [resolve(process.cwd(), 'scripts/ensure-local-pose.mjs')], { windowsHide: true, stdio: 'ignore' });
        child.once('error', () => done());
        child.once('exit', () => done());
      }).finally(() => { this.localStartup = undefined; });
    }
    await this.localStartup;
    for (let attempt = 0; attempt < 20; attempt++) {
      try { if ((await fetch('http://127.0.0.1:8000/health', { signal: AbortSignal.timeout(500) })).ok) return; } catch { /* Starting. */ }
      await new Promise(done => setTimeout(done, 250));
    }
  }
  async isHealthy() {
    const endpoint = this.config.get<string>('POSE_ANALYSIS_URL');
    if (!this.isAvailable() || !endpoint) return false;
    try {
      const health = new URL(endpoint);
      health.pathname = health.pathname.replace(/\/analyze\/?$/, '/health');
      if (health.pathname === new URL(endpoint).pathname) return false;
      health.search = ''; health.hash = '';
      const response = await fetch(health, { signal: AbortSignal.timeout(75000), redirect: 'error' });
      const result = await response.json() as { available?: unknown };
      return response.ok && result.available === true;
    } catch {
      await this.recoverLocalProvider(endpoint);
      try {
        const health = new URL(endpoint);
        health.pathname = health.pathname.replace(/\/analyze\/?$/, '/health');
        const response = await fetch(health, { signal: AbortSignal.timeout(5000), redirect: 'error' });
        return response.ok && (await response.json() as { available?: unknown }).available === true;
      } catch { return false; }
    }
  }
  async analyze(payload: {
    mediaBase64: string;
    mimeType: string;
    analysisType?: 'workout' | 'readiness';
    requestedChecks?: ('fullBodyInFrame' | 'lighting' | 'distance')[];
    durationSeconds?: number;
    exerciseHint?: 'chest_press' | 'squat';
  }) {
    const endpoint = this.config.get<string>('POSE_ANALYSIS_URL');
    const apiKey = this.config.get<string>('POSE_ANALYSIS_API_KEY');
    if (!endpoint || !apiKey) throw new Error('Pose provider is not configured');
    const request = () => outboundFetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` }, body: JSON.stringify(payload), signal: AbortSignal.timeout(90_000) });
    let response: Response;
    try { response = await request(); } catch (error) {
      if (process.env.NODE_ENV === 'production' || endpoint !== 'http://127.0.0.1:8000/analyze') throw error;
      await this.recoverLocalProvider(endpoint);
      response = await request();
    }
    if (!response.ok) throw new Error(`Pose provider returned ${response.status}`);
    const result = await response.json() as { analysis?: unknown };
    if (!result.analysis || typeof result.analysis !== 'object' || Array.isArray(result.analysis) || JSON.stringify(result.analysis).length > 5_000_000) throw new Error('Pose provider returned an invalid analysis');
    return result.analysis;
  }
}
