import { BadRequestException, Body, Controller, Get, Header, Injectable, Module, NotFoundException, Param, Put, Post, Req, ServiceUnavailableException, UseGuards } from '@nestjs/common';
import { InjectModel, MongooseModule } from '@nestjs/mongoose';
import { Schema, Model } from 'mongoose';
import { z } from 'zod';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { ExerciseDbModule } from '../exercises/exercisedb.module.js';
import { CatalogSyncService } from '../exercises/catalog-sync.service.js';
import { auditCoverage, canTrack, resolveTrackingConfig, validateOverride, type CatalogExercise, type ConfigOverride } from './exercise-registry.js';
import { AuthRateLimit, AuthRateLimitSchema } from '../auth/auth-rate-limit.schema.js';
import { PoseTrackerRateLimitGuard } from './pose-tracker-rate-limit.guard.js';

// Zod schema for generated-angle config
const generatedAngleConfigSchema = z.object({
  source: z.literal('gif-derived'),
  verified: z.boolean(),
  liveValidated: z.boolean(),
  primaryJoints: z.array(z.string()).min(1),
  sideMode: z.enum(['bilateral','unilateral','alternating','unknown']),
  startAngles: z.record(z.string(), z.number()),
  peakAngles: z.record(z.string(), z.number()),
  directions: z.record(z.string(), z.enum(['increasing','decreasing'])),
  referenceRanges: z.record(z.string(), z.number()),
  stabilityConstraints: z.array(z.object({ joint: z.string(), meanAngle: z.number(), tolerance: z.number() })),
  viewHint: z.enum(['front','side','unknown']),
  cycleCount: z.number().int().nonnegative(),
  validFraction: z.number().min(0).max(1),
  thresholdsUsed: z.record(z.string(), z.number()),
  generatorVersion: z.string(),
  generatedAt: z.string(),
}).strict();

const configSchema = new Schema({ exerciseId: { type: String, required: true, unique: true }, config: { type: Object, required: true }, updatedBy: { type: String, required: true } }, { timestamps: true, strict: 'throw' });
const input = z.object({
  trackingMode: z.enum(['builtin','reference','generated-angle','unavailable']),
  providerExerciseId: z.string().max(80).optional(),
  referenceUuid: z.string().uuid().optional(),
  generatedAngleConfig: generatedAngleConfigSchema.optional(),
  cameraOrientation: z.enum(['front','side','reference','pending']),
  validationStatus: z.enum(['pending','verified','disabled']),
  limitations: z.array(z.string().max(500)).max(20),
  verificationNotes: z.string().max(2000).optional()
}).strict().refine(data => {
  if (data.trackingMode === 'builtin') return !data.referenceUuid && !data.generatedAngleConfig;
  if (data.trackingMode === 'reference') return !data.providerExerciseId && !data.generatedAngleConfig;
  if (data.trackingMode === 'generated-angle') return !!data.generatedAngleConfig && !data.providerExerciseId && !data.referenceUuid;
  if (data.trackingMode === 'unavailable') return !data.providerExerciseId && !data.referenceUuid && !data.generatedAngleConfig;
  return true;
}, { message: 'Mutually exclusive tracking identifiers' });
@Injectable()
export class PoseTrackerService {
  constructor(@InjectModel('ExercisePoseTrackerConfig') private readonly configs: Model<any>, private readonly catalog: CatalogSyncService) {}
  async rows() { try { return await this.catalog.trackingCatalog() as unknown as CatalogExercise[]; } catch { throw new ServiceUnavailableException('Exercise catalog is unavailable'); } }
  async resolve(id: string) {
    if (!/^[a-zA-Z0-9_-]{1,80}$/.test(id)) throw new BadRequestException('Invalid exercise ID');
    let row: CatalogExercise | null;
    try { row = await this.catalog.trackingRecord(id) as unknown as CatalogExercise | null; }
    catch { throw new ServiceUnavailableException('Exercise catalog is unavailable'); }
    if (!row) throw new NotFoundException('Exercise not in catalog');
    const stored = await this.configs.findOne({ exerciseId: id }).lean();
    if(stored?.config)try{validateOverride(stored.config);}catch{throw new ServiceUnavailableException('Stored tracking configuration needs administrator review');}
    return resolveTrackingConfig(row, stored?.config);
  }
  async audit() {
    const [rows, saved] = await Promise.all([this.rows(), this.configs.find().lean()]);
    return auditCoverage(rows, Object.fromEntries(saved.map(s => [s.exerciseId,s.config])));
  }
  async save(id: string, body: unknown, userId: string) {
    await this.resolve(id);
    const parsed = input.safeParse(body);
    if (!parsed.success) throw new BadRequestException('Invalid PoseTracker configuration');
    const config: ConfigOverride = parsed.data;
    try { validateOverride(config); } catch (e) { throw new BadRequestException((e as Error).message); }
    // An admin records observed provider evidence, never inferred from UUID syntax alone.
    config.updatedAt = new Date().toISOString();
    if (config.validationStatus === 'verified') config.verifiedAt = config.updatedAt;
    await this.configs.updateOne({ exerciseId: id }, { $set: { config, updatedBy: userId } }, { upsert: true, runValidators: true });
    return this.resolve(id);
  }
  async launch(id: string, adminTest = false) {
    const config = await this.resolve(id);
    const testable = adminTest && config.validationStatus !== 'disabled' && config.trackingMode !== 'unavailable';
    if (!canTrack(config) && !testable) throw new BadRequestException('This exercise needs a verified tracking configuration. Manual workout logging remains available.');

    // Generated-angle mode runs locally, no provider token needed
    if (config.trackingMode === 'generated-angle') {
      return { config, token: null, developerOutputs: false };
    }

    // Provider-backed modes (builtin/reference) require token
    if (process.env.POSETRACKER_ENABLED?.trim().toLowerCase() !== 'true') throw new ServiceUnavailableException('PoseTracker sessions are currently disabled.');
    const token = process.env.POSETRACKER_API_TOKEN?.trim();
    if (!token) throw new BadRequestException('PoseTracker is not configured. Ask your administrator to configure the provider token.');
    return { config, token, developerOutputs: process.env.POSETRACKER_DEVELOPER_OUTPUTS === 'true' };
  }
}
@Controller('pose-tracker')
@UseGuards(JwtAuthGuard)
export class PoseTrackerController {
  constructor(private readonly service: PoseTrackerService) {}
  @Get('exercises/:id')
  @Header('Cache-Control','private, no-store')
  resolve(@Param('id') id: string) { return this.service.resolve(id); }
  @Post('exercises/:id/launch')
  @UseGuards(PoseTrackerRateLimitGuard)
  @Header('Cache-Control','private, no-store')
  launch(@Param('id') id: string) { return this.service.launch(id); }
  @Post('configurations')
  @Header('Cache-Control','private, no-store')
  configurations(@Body() body: unknown) {
    const parsed=z.object({ids:z.array(z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/)).max(100)}).strict().safeParse(body);
    if(!parsed.success)throw new BadRequestException('Invalid exercise IDs');
    return Promise.all([...new Set(parsed.data.ids)].map(id=>this.service.resolve(id)));
  }
}
@Controller('admin/pose-tracker')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class PoseTrackerAdminController {
  constructor(private readonly service: PoseTrackerService) {}
  @Get('coverage') audit() { return this.service.audit(); }
  @Put('exercises/:id') save(@Param('id') id: string, @Body() body: unknown, @Req() req: any) { return this.service.save(id,body,String(req.user.id ?? req.user.sub)); }
  @Post('exercises/:id/test')
  @UseGuards(PoseTrackerRateLimitGuard)
  @Header('Cache-Control','private, no-store')
  test(@Param('id') id: string) { return this.service.launch(id,true); }
}
@Module({ imports: [ExerciseDbModule, MongooseModule.forFeature([{ name: 'ExercisePoseTrackerConfig', schema: configSchema }, {name:AuthRateLimit.name, schema:AuthRateLimitSchema}])], providers: [PoseTrackerService, PoseTrackerRateLimitGuard], controllers: [PoseTrackerController,PoseTrackerAdminController] })
export class PoseTrackerModule {}
