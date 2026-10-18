import { BadRequestException, Body, Controller, Module, Post } from '@nestjs/common';
import { z } from 'zod';
import { ExerciseDbModule } from '../exercises/exercisedb.module.js';
import { ExerciseDbService, SOURCE } from '../exercises/exercisedb.service.js';
import { CoachPlanner } from './coach-planner.js';

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
export class CoachPreviewController {
  constructor(private readonly catalog: ExerciseDbService) {}
  @Post('plan')
  async plan(@Body() body: unknown) {
    const parsed = z.object({ profile: profileSchema }).strict().safeParse(body);
    if (!parsed.success) throw new BadRequestException({ message: 'Invalid program context', errors: parsed.error.flatten() });
    const rows = await this.catalog.getForPlan(parsed.data.profile.equipment, parsed.data.profile.goal);
    return { ...new CoachPlanner().build(parsed.data.profile, rows.map(row => ({ ...row, id: row._id }))), source: rows.some(row => row.source === 'PhysiqueQuest') ? `${SOURCE} + PhysiqueQuest` : SOURCE, coverageNote: 'Plan generated from a bounded ExerciseDB selection and available PhysiqueQuest manual exercises.' };
  }
}

// Compatibility preview route lives inside the main API and shares its provider singleton.
@Module({ imports: [ExerciseDbModule], controllers: [CoachPreviewController] })
export class CoachPreviewModule {}
