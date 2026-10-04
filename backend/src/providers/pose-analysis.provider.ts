import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PoseAnalysisProvider {
  constructor(private readonly config: ConfigService) {}
  isAvailable() { return Boolean(this.config.get<string>('POSE_ANALYSIS_URL') && this.config.get<string>('POSE_ANALYSIS_API_KEY')); }
  async analyze(payload: { mediaBase64: string; mimeType: string; durationSeconds?: number }) {
    const endpoint = this.config.get<string>('POSE_ANALYSIS_URL');
    const apiKey = this.config.get<string>('POSE_ANALYSIS_API_KEY');
    if (!endpoint || !apiKey) throw new Error('Pose provider is not configured');
    const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` }, body: JSON.stringify(payload), signal: AbortSignal.timeout(60_000) });
    if (!response.ok) throw new Error(`Pose provider returned ${response.status}`);
    const result = await response.json() as { analysis?: unknown };
    if (!result.analysis || typeof result.analysis !== 'object') throw new Error('Pose provider returned an invalid analysis');
    return result.analysis;
  }
}
