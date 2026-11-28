import { Controller, Get, Post, Patch, Body, Req, Query, Param, UseGuards, BadRequestException, Optional, NotFoundException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Types, type Connection } from 'mongoose';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { ActivityService } from '../activity/activity.service.js';
import { CoachService } from '../coach/coach.service.js';
import { PrivacyService } from '../privacy/privacy.service.js';

@Controller('admin/dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminDashboardController {
  constructor(@InjectConnection() private readonly db: Connection, @Optional() private readonly activity?: ActivityService, @Optional() private readonly coach?: CoachService, @Optional() private readonly privacy?: PrivacyService) {}

  @Get('users')
  async users(@Query('search') search = '', @Query('page') rawPage = '1', @Req() req?: {user:{userId:string}}) {
    const page = Math.max(1, Math.min(10000, Number.parseInt(rawPage, 10) || 1));
    const term = search.trim().slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const filter = { deletedAt: null, role: { $in: ['user', null] }, ...(term ? { $or: [{ name: { $regex: term, $options: 'i' } }, { email: { $regex: term, $options: 'i' } }] } : {}) };
    const users = this.db.collection('users');
    const [items, total] = await Promise.all([
      users.find(filter, { projection: { name: 1, email: 1, createdAt: 1, isActive: 1 } }).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * 25).limit(25).toArray(),
      users.countDocuments(filter),
    ]);
    const lastSeen = await this.db.collection('sign_in_events').aggregate([
      { $match: { userId: { $in: items.map(item => item._id) } } },
      { $group: { _id: '$userId', lastSignIn: { $max: '$occurredAt' } } },
    ]).toArray();
    const signIns = new Map(lastSeen.map(row => [String(row._id), row.lastSignIn]));
    if (req && this.privacy) await this.privacy.audit({actorId:req.user.userId, action:'admin_user_directory_viewed', status:200});
    return { items: items.map(item => ({ ...item, lastSignIn: signIns.get(String(item._id)) ?? null })), total, page, pageSize: 25 };
  }

  @Get('users/:id')
  async user(@Param('id') id: string, @Req() req?: { user: { userId: string } }) {
    if (!Types.ObjectId.isValid(id) || id.length !== 24) throw new BadRequestException('Invalid user ID');
    const userId = new Types.ObjectId(id);
    const user = await this.db.collection('users').findOne({ _id: userId, deletedAt: null, role: { $in: ['user', null] } }, { projection: { name: 1, email: 1, createdAt: 1, isActive: 1 } });
    if (!user) return null;
    const profile = await this.db.collection('profiles').findOne({ userId }, { projection: { _id: 0, name: 1, age: 1, height: 1, heightInches: 1, heightUnit: 1, weight: 1, weightUnit: 1, goal: 1 } });
    const [split, summary] = await Promise.all([
      this.coach?.getSavedPlanForAdmin(id).catch(() => null) ?? null,
      this.activity?.getForAdmin(id).catch(() => null) ?? null,
    ]);
    if (req && this.privacy) await this.privacy.audit({ actorId: req.user.userId, action: 'admin_user_profile_viewed', targetId: id });
    return { user, profile, split, badges: summary ? summary.badges.filter(badge => badge.earned).map(badge => ({ id: badge.id, title: badge.title })) : null, badgeCoverageIncomplete: summary ? summary.badges.some(badge => 'available' in badge && badge.available === false) : true };
  }

  @Get('feedback')
  async feedback(@Query('page') rawPage = '1', @Query('status') status = '', @Query('category') category = '', @Query('search') search = '', @Query('platform') platform = '', @Query('rating') rating = '', @Query('version') version = '', @Query('from') from = '', @Query('to') to = '', @Req() req?: {user:{userId:string}}) {
    const page = Math.max(1, Math.min(10000, Number.parseInt(rawPage, 10) || 1));
    const collection = this.db.collection('app_feedback');
    if (status && !['new', 'in_progress', 'resolved'].includes(status)) throw new BadRequestException('Invalid status');
    if (category && !['bug', 'idea', 'praise', 'other'].includes(category)) throw new BadRequestException('Invalid category');
    if (platform && !['web', 'android', 'ios'].includes(platform)) throw new BadRequestException('Invalid platform');
    if (rating && !['1','2','3','4','5'].includes(rating)) throw new BadRequestException('Invalid rating');
    if (version.length > 40) throw new BadRequestException('Invalid version');
    const date = (value: string) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new BadRequestException('Invalid date');
      const parsed = new Date(`${value}T00:00:00.000Z`);
      if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0,10) !== value) throw new BadRequestException('Invalid date');
      return parsed;
    };
    const fromDate = from ? date(from) : undefined, toDate = to ? date(to) : undefined;
    if (fromDate && toDate && fromDate > toDate) throw new BadRequestException('Start date must precede end date');
    if (toDate) toDate.setUTCDate(toDate.getUTCDate()+1);
    const term = search.trim().slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const filter = { ...(status === 'new' ? { $or: [{ adminStatus: 'new' }, { adminStatus: { $exists: false } }] } : status ? { adminStatus: status } : {}), ...(category ? { category } : {}), ...(platform ? { platform } : {}), ...(rating ? { rating: Number(rating) } : {}), ...(version ? { appVersion: version } : {}), ...(fromDate || toDate ? { createdAt: { ...(fromDate ? { $gte: fromDate } : {}), ...(toDate ? { $lt: toDate } : {}) } } : {}), ...(term ? { message: { $regex: term, $options: 'i' } } : {}) };
    const [items, total] = await Promise.all([collection.find(filter, { projection: { rating: 1, category: 1, message: 1, appVersion: 1, platform: 1, createdAt: 1, adminStatus: 1, adminNote: 1, adminUpdatedAt: 1 } }).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * 25).limit(25).toArray(), collection.countDocuments(filter)]);
    if (req && this.privacy) await this.privacy.audit({actorId:req.user.userId, action:'admin_feedback_viewed', status:200});
    return { items, total, page, pageSize: 25 };
  }

  @Patch('feedback/:id')
  async updateFeedback(@Param('id') id: string, @Body() body: { status?: unknown; note?: unknown }, @Req() req: { user: { userId: string } }) {
    if (!Types.ObjectId.isValid(id) || id.length !== 24 || !body || typeof body.status !== 'string' || !['new', 'in_progress', 'resolved'].includes(body.status) || typeof body.note !== 'string' || body.note.length > 1000) throw new BadRequestException('Invalid feedback update');
    if (this.privacy) await this.privacy.audit({ actorId: req.user.userId, targetId: id, action: 'admin_feedback_update_attempted' });
    const result = await this.db.collection('app_feedback').updateOne({ _id: new Types.ObjectId(id) }, { $set: { adminStatus: body.status, adminNote: body.note.trim(), adminUpdatedAt: new Date() } });
    if (!result.matchedCount) throw new NotFoundException('Feedback not found');
    if (this.privacy) await this.privacy.audit({ actorId: req.user.userId, targetId: id, action: 'admin_feedback_updated', status: 200 });
    return { saved: true };
  }

  @Get('exercise-feedback')
  async exerciseFeedback(@Query('source') source = '', @Query('search') search = '', @Query('days') days = '') {
    if (source && !['pose','manual'].includes(source)) throw new BadRequestException('Invalid source');
    if (days && !['7','30','90'].includes(days)) throw new BadRequestException('Invalid period');
    const term = search.trim().slice(0,100).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return this.db.collection('workout_feedback').aggregate([
      { $match: { ...(source ? { source } : {}), ...(term ? { exercise: { $regex: term, $options: 'i' } } : {}), ...(days ? { createdAt: { $gte: new Date(Date.now()-Number(days)*86400_000), $lte: new Date() } } : {}) } },
      { $group: { _id: { exercise: '$exercise', source: '$source' }, responses: { $sum: 1 }, averageRpe: { $avg: '$rpe' }, averageEnjoyment: { $avg: '$enjoyment' }, tooEasy: { $sum: { $cond: [{ $eq: ['$difficulty', 'too_easy'] }, 1, 0] } }, justRight: { $sum: { $cond: [{ $eq: ['$difficulty', 'just_right'] }, 1, 0] } }, tooHard: { $sum: { $cond: [{ $eq: ['$difficulty', 'too_hard'] }, 1, 0] } } } },
      { $sort: { responses: -1, '_id.exercise': 1 } }, { $limit: 100 },
    ]).toArray();
  }

  @Get('foods')
  async foods() {
    const [top, scans, mealTotals] = await Promise.all([this.db.collection('nutrition').aggregate([
      { $unwind: '$meals' }, { $match: { 'meals.name': { $type: 'string', $ne: '' } } },
      { $group: { _id: '$meals.name', count: { $sum: 1 } } }, { $sort: { count: -1, _id: 1 } }, { $limit: 20 },
    ]).toArray(), this.db.collection('food_scan_usage').aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]).toArray(), this.db.collection('nutrition').aggregate([
      { $unwind: '$meals' }, { $group: { _id: null, total: { $sum: 1 }, savedScans: { $sum: { $cond: [{ $eq: [{ $type: '$meals.scanSavedAt' }, 'date'] }, 1, 0] } } } },
    ]).toArray()]);
    return { top, scans: scans.map(row => ({ status: row._id, count: row.count })), meals: mealTotals[0]?.total ?? 0, savedScanEntries: mealTotals[0]?.savedScans ?? 0 };
  }
  @Post('pose-evidence')
  async addEvidence(@Body() body: { exercise?: unknown; verified?: unknown; predicted?: unknown; conditions?: unknown }, @Req() req: { user: { userId: string } }) {
    if (!body) throw new BadRequestException('Enter a valid reviewed set.');
    const exercise = typeof body.exercise === 'string' ? body.exercise.trim() : '';
    const conditions = typeof body.conditions === 'string' ? body.conditions.trim() : '';
    if (!exercise || exercise.length > 100 || conditions.length > 300 || !Number.isSafeInteger(body.verified) || !Number.isSafeInteger(body.predicted) || Number(body.verified) < 0 || Number(body.predicted) < 0 || Number(body.verified) > 10000 || Number(body.predicted) > 10000) throw new BadRequestException('Enter a valid exercise and nonnegative whole rep counts.');
    await this.db.collection('admin_pose_evidence').insertOne({ exercise, verified: body.verified, predicted: body.predicted, conditions, reviewerId: req.user.userId, createdAt: new Date() });
    if (this.privacy) await this.privacy.audit({ actorId: req.user.userId, action: 'admin_pose_evidence_added', status: 200 });
    return { saved: true };
  }

  @Get('audit')
  async audit() {
    const items = await this.db.collection('audit_logs').find({ action: /^admin_/ }, { projection: { action: 1, actorId: 1, targetId: 1, status: 1, occurredAt: 1 } }).sort({ occurredAt: -1 }).limit(100).toArray();
    return { items };
  }

  @Get('pose-evidence')
  async poseEvidence() {
    const rows = await this.db.collection('admin_pose_evidence').aggregate([
      { $group: { _id: '$exercise', sets: { $sum: 1 }, verified: { $sum: '$verified' }, error: { $sum: { $cond: [{ $gt: ['$verified', 0] }, { $abs: { $subtract: ['$predicted', '$verified'] } }, 0] } }, zeroRepSets: { $sum: { $cond: [{ $eq: ['$verified', 0] }, 1, 0] } }, zeroRepFalsePositives: { $sum: { $cond: [{ $and: [{ $eq: ['$verified', 0] }, { $gt: ['$predicted', 0] }] }, 1, 0] } }, lastReviewed: { $max: '$createdAt' } } },
      { $sort: { _id: 1 } }, { $limit: 500 },
    ]).toArray();
    return rows.map(row => ({ exercise: row._id, sets: row.sets, verified: row.verified, agreement: row.verified > 0 ? Math.max(0, 1 - row.error / row.verified) * 100 : null, zeroRepSets: row.zeroRepSets, zeroRepFalsePositives: row.zeroRepFalsePositives, lastReviewed: row.lastReviewed }));
  }
}


