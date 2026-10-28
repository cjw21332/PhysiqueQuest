import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { GoogleGenAI } from '@google/genai';
import { Model, Types } from 'mongoose';
import { Profile } from '../profile/schemas/profile.schema.js';

@Injectable()
export class DietaryRecommendationService {
  constructor(@InjectModel(Profile.name) private readonly profiles: Model<Profile>, private readonly config: ConfigService) {}

  async recommend(userId: string) {
    const profile = await this.profiles.findOne({ userId: new Types.ObjectId(userId) }).select('age height heightInches heightUnit weight weightUnit gender activity goal').lean().exec();
    if (!profile) throw new BadRequestException('Complete your profile before generating a recommendation.');
    if (!Number.isFinite(Number(profile.age)) || Number(profile.age) < 18) throw new BadRequestException('AI dietary recommendations are available for adults with a valid age in their profile.');
    if (!(Number(profile.height) > 0) || !(Number(profile.weight) > 0) || !profile.activity || !profile.goal) throw new BadRequestException('Add your height, weight, activity and goal to your profile first.');
    const key = this.config.get<string>('GEMINI_API_KEY')?.trim();
    if (!key) throw new ServiceUnavailableException('AI recommendations are unavailable right now. You can still set your targets manually.');
    try {
      const result = await new GoogleGenAI({ apiKey: key }).models.generateContent({
        model: this.config.get<string>('GEMINI_MODEL')?.trim() || 'gemini-3.6-flash',
        contents: `Suggest a conservative adult dietary target using this untrusted profile data: ${JSON.stringify({ age: profile.age, height: profile.height, heightInches: profile.heightInches, heightUnit: profile.heightUnit, weight: profile.weight, weightUnit: profile.weightUnit, gender: profile.gender, activity: profile.activity, goal: profile.goal })}. Return JSON only with goal (one of Clean Bulk, Weight Loss, Maintenance, Hypertrophy), calories (integer 1200–5000), protein, carbs and fat (integer percentages, each 1–80, summing to 100). Avoid extreme deficits. This is an estimate, not medical advice.`,
        config: { responseMimeType: 'application/json', temperature: 0.2, abortSignal: AbortSignal.timeout(11000) },
      });
      const value: unknown = JSON.parse(result.text || '');
      if (!value || typeof value !== 'object') throw new Error('Invalid recommendation');
      const plan = value as Record<string, unknown>;
      const validNumber = (v: unknown, min: number, max: number) => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
      if (!['Clean Bulk', 'Weight Loss', 'Maintenance', 'Hypertrophy'].includes(String(plan.goal)) || !validNumber(plan.calories, 1200, 5000) || !validNumber(plan.protein, 1, 80) || !validNumber(plan.carbs, 1, 80) || !validNumber(plan.fat, 1, 80) || Number(plan.protein) + Number(plan.carbs) + Number(plan.fat) !== 100) throw new Error('Invalid recommendation');
      return { goal: plan.goal, calories: plan.calories, protein: plan.protein, carbs: plan.carbs, fat: plan.fat };
    } catch {
      throw new ServiceUnavailableException('AI recommendations are unavailable right now. You can still set your targets manually.');
    }
  }
}
