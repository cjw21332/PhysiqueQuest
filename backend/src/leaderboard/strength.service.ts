import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { WorkoutSession } from '../workouts/schemas/workout-session.schema.js';
import { Profile } from '../profile/schemas/profile.schema.js';
import { User } from '../auth/schemas/user.schema.js';
import { Settings } from '../settings/schemas/settings.schema.js';

export function estimatedMax(load: number, reps: number): number {
  return reps === 1 ? load : load * (1 + reps / 30);
}

@Injectable()
export class StrengthService {
  constructor(@InjectModel(WorkoutSession.name) private readonly workouts: Model<WorkoutSession>, @InjectModel(Profile.name) private readonly profiles: Model<Profile>, @InjectModel(User.name) private readonly users: Model<User>, @InjectModel(Settings.name) private readonly settings: Model<Settings>) {}

  async get(userId: string, exerciseId?: string, metric = 'heaviest') {
    if (!['heaviest', 'relative'].includes(metric)) throw new BadRequestException('Invalid ranking method');
    if (exerciseId && (exerciseId.length > 80 || !exerciseId.trim())) throw new BadRequestException('Invalid exercise');
    const hidden = new Set((await this.settings.find({ 'values.showLeaderboard': false }).select('userId').lean().exec()).map(item => String(item.userId)));
    const best = new Map<string, { userId: string; exerciseId: string; name: string; maxKg: number; loadKg: number; reps: number }>();
    const cursor = this.workouts.find({ status: 'completed', 'sets.status': 'completed' }).select('userId exercises sets').lean().cursor();
    for await (const workout of cursor) {
      const owner = String(workout.userId);
      if (hidden.has(owner) && owner !== userId) continue;
      for (const set of workout.sets ?? []) {
        if (set.status !== 'completed' || !Number.isFinite(set.loadKg) || !(set.loadKg! > 0) || !Number.isInteger(set.reps) || set.reps < 1 || set.reps > 30 || set.durationSeconds) continue;
        const exercise = workout.exercises?.find(item => item.exerciseId === set.exerciseId);
        if (!exercise?.name) continue;
        const maxKg = estimatedMax(set.loadKg!, set.reps), key = `${owner}:${set.exerciseId}`;
        if (!best.has(key) || maxKg > best.get(key)!.maxKg) best.set(key, { userId: owner, exerciseId: set.exerciseId, name: exercise.name, maxKg, loadKg: set.loadKg!, reps: set.reps });
      }
    }
    const options = [...new Map([...best.values()].filter(item => !hidden.has(item.userId) || item.userId === userId).map(item => [item.exerciseId, { id: item.exerciseId, name: item.name }])).values()].sort((a, b) => a.name.localeCompare(b.name));
    const selected = exerciseId ?? options[0]?.id ?? null;
    const candidates = [...best.values()].filter(item => item.exerciseId === selected);
    const ids = candidates.map(item => item.userId).filter(Types.ObjectId.isValid).map(id => new Types.ObjectId(id));
    const [users, profiles] = await Promise.all([
      this.users.find({ _id: { $in: ids }, isActive: { $ne: false }, deletedAt: null }).select('name').lean().exec(),
      this.profiles.collection.find({ userId: { $in: ids } }, { projection: { userId: 1, weight: 1, weightUnit: 1 } }).toArray(),
    ]);
    const names = new Map(users.map(user => [String(user._id), user.name]));
    const weights = new Map(profiles.map(profile => { const weight = Number(profile.weight); return [String(profile.userId), profile.weightUnit === 'lbs' ? weight / 2.2046226218 : profile.weightUnit === 'kg' ? weight : NaN] as const; }));
    const ranked = candidates.filter(item => names.has(item.userId) && (!hidden.has(item.userId) || item.userId === userId)).map(item => ({ ...item, name: names.get(item.userId)!, bodyweightKg: weights.get(item.userId), score: metric === 'relative' ? item.maxKg / (weights.get(item.userId) ?? NaN) : item.maxKg })).filter(item => Number.isFinite(item.score) && item.score > 0).sort((a, b) => b.score - a.score || a.userId.localeCompare(b.userId)).map((item, index) => ({ ...item, rank: index + 1, isCurrentUser: item.userId === userId }));
    return { exercises: options, exerciseId: selected, metric, entries: ranked.filter(item => !hidden.has(item.userId)), self: ranked.find(item => item.isCurrentUser) ?? null, hidden: hidden.has(userId) };
  }
}
