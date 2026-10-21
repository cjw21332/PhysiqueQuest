import { Controller, Get, ServiceUnavailableException, UseGuards } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import type { Connection } from 'mongoose';
import { JwtAuthGuard } from './auth/jwt-auth.guard.js';
import { RolesGuard } from './auth/roles.guard.js';
import { Roles } from './auth/roles.decorator.js';
import { httpMetrics } from './common/http-metrics.js';

@Controller()
export class HealthController {
  constructor(@InjectConnection() private readonly connection: Connection) {}
  @Get('health') health() { return { status: 'ok' }; }
  @Get('ready') async ready() {
    if (this.connection.readyState !== 1 || !this.connection.db) throw new ServiceUnavailableException('Not ready');
    try { await this.connection.db.command({ ping: 1 }, { timeoutMS: 2000 }); }
    catch { throw new ServiceUnavailableException('Not ready'); }
    return { status: 'ready' };
  }
  @Get('config') config() {
    return { apiVersion: 1, minimumAppVersion: process.env.MIN_APP_VERSION ?? null, requireAppVersion: process.env.REQUIRE_APP_VERSION === 'true', authentication: { rotatingSessions: true, legacyTokensAccepted: process.env.LEGACY_AUTH_ENABLED !== 'false', verificationEnforced: process.env.EMAIL_VERIFICATION_ENFORCED === 'true' } };
  }
  @Get('admin/metrics')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async metrics() {
    const queue = await Promise.all(['background_jobs', 'analysis_jobs', 'push_deliveries'].map(async name => {
      const jobs = this.connection.db ? await this.connection.db.collection(name).aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ], { maxTimeMS: 2000 }).toArray() : [];
      return [name, Object.fromEntries(jobs.map(job => [job._id, job.count]))];
    }));
    return { ...httpMetrics(), queue: Object.fromEntries(queue) };
  }
}
