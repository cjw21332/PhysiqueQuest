import { BadRequestException, Body, Controller, Get, Header, Module, Param, Post, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { ConfigModule } from '@nestjs/config';
import { ExerciseDbModule } from '../exercises/exercisedb.module.js';
import { ExerciseDbService, SOURCE } from '../exercises/exercisedb.service.js';
import { CoachPlanner } from './coach-planner.js';
import { parseCatalogQuery } from '../exercises/catalog-query.js';
import { CoachRateLimitGuard } from './coach-rate-limit.guard.js';

const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
const indexedDays: Record<string, string> = Object.fromEntries(['m-0', 't-1', 'w-2', 't-3', 'f-4', 's-5', 's-6'].map((id, index) => [id, weekdays[index]]));
const initialDays: Record<string, string[]> = { m: ['Monday'], t: ['Tuesday', 'Thursday'], w: ['Wednesday'], f: ['Friday'], s: ['Saturday', 'Sunday'] };

// Profiles predating full weekday names stored repeated T/S initials or indexed IDs.
// Preserve duplicates/unknowns for validation rather than silently dropping them.
function normalizeSavedDays(value: unknown): unknown {
  if (!Array.isArray(value)) return value;
  const occurrences: Record<string, number> = {};
  return value.map(day => {
    if (typeof day !== 'string') return day;
    const key = day.trim().toLowerCase();
    const canonical = weekdays.find(name => name.toLowerCase() === key) ?? indexedDays[key];
    if (canonical) return canonical;
    const index = occurrences[key] ?? 0;
    occurrences[key] = index + 1;
    return initialDays[key]?.[index] ?? day;
  });
}

const profileSchema = z.object({
  goal: z.enum(['Build muscle', 'Strength', 'Weight loss', 'Endurance', 'General fitness']),
  days: z.preprocess(normalizeSavedDays, z.array(z.enum(weekdays)).min(1).max(7).refine(days => new Set(days).size === days.length, 'Days must be distinct')),
  duration: z.enum(['20 min', '30 min', '45 min', '60 min']),
  equipment: z.array(z.enum(['Full gym', 'Dumbbells', 'Dumbbell', 'Barbell', 'Bodyweight', 'Bodyweight only', 'Resistance bands', 'Cable', 'Machine', 'Kettlebell'])).max(10),
  conditions: z.array(z.string().trim().min(1).max(80)).max(10),
  createdAt: z.iso.datetime().optional(),
}).strict();

@Controller('coach')
@UseGuards(CoachRateLimitGuard)
export class StandaloneCoachController {
  constructor(private readonly catalog: ExerciseDbService) {}
  @Get('status')
  status() { return { status: 'ready', source: SOURCE, persistence: 'stateless', media: 'GIF', attribution: 'ExerciseDB by AscendAPI — https://oss.exercisedb.dev', coverageNote: 'Plans use a bounded live catalog selection. Availability depends on ExerciseDB.' }; }
  @Post('plan')
  async plan(@Body() body: unknown) {
    const parsed = z.object({ profile: profileSchema }).strict().safeParse(body);
    if (!parsed.success) throw new BadRequestException({ message: 'Invalid program context', errors: parsed.error.flatten() });
    const rows = await this.catalog.getForPlan(parsed.data.profile.equipment, parsed.data.profile.goal);
    return { ...new CoachPlanner().build(parsed.data.profile, rows.map(row => ({ ...row, id: row._id }))), source: SOURCE, coverageNote: 'Plan generated from a bounded live ExerciseDB selection.' };
  }
}

@Controller('exercises')
@UseGuards(CoachRateLimitGuard)
export class StandaloneExercisesController {
  constructor(private readonly catalog: ExerciseDbService) {}
  @Get()
  @Header('Cache-Control', 'public, max-age=30')
  list(@Query() query: { search?: string; muscle?: string; equipment?: string; page?: string; limit?: string }) {
    return this.catalog.findAll(parseCatalogQuery(query));
  }
  @Get(':id')
  @Header('Cache-Control', 'public, max-age=30')
  detail(@Param('id') id: string) { return this.catalog.findBySlug(id); }
}

@Module({ imports: [ConfigModule.forRoot(), ExerciseDbModule], controllers: [StandaloneCoachController, StandaloneExercisesController], providers: [CoachRateLimitGuard] })
export class StandaloneCoachModule {}
