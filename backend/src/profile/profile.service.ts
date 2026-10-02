import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, type HydratedDocument } from 'mongoose';
import { Profile } from './schemas/profile.schema.js';
import { CreateProfileDto, UpdateProfileDto } from './dto/profile.dto.js';

@Injectable()
export class ProfileService {
  constructor(
    @InjectModel(Profile.name) private profileModel: Model<Profile>,
  ) {}

  async create(userId: string, createProfileDto: CreateProfileDto): Promise<HydratedDocument<Profile>> {
    validateProfileMeasurements(createProfileDto);
    const ownerId = new Types.ObjectId(userId);
    // Check if profile already exists for this user
    const existingProfile = await this.profileModel.findOne({ userId: ownerId });
    if (existingProfile) {
      throw new ConflictException('Profile already exists for this user');
    }

    // Create profile
    const profile = await this.profileModel.create({
      ...createProfileDto,
      userId: ownerId,
    }).catch((error: unknown) => {
      if (isDuplicateKeyError(error)) throw new ConflictException('Profile already exists for this user');
      throw error;
    });

    return profile;
  }

  async findByUserId(userId: string): Promise<HydratedDocument<Profile>> {
    const profile = await this.profileModel.findOne({ userId: new Types.ObjectId(userId) });
    if (!profile) {
      throw new NotFoundException('Profile not found');
    }
    return profile;
  }

  async update(userId: string, updateProfileDto: UpdateProfileDto): Promise<HydratedDocument<Profile>> {
    const current = await this.findByUserId(userId);
    validateProfileMeasurements({ ...current.toObject(), ...updateProfileDto });
    const profile = await this.profileModel.findOneAndUpdate(
      { userId: new Types.ObjectId(userId) },
      { $set: updateProfileDto },
      { new: true, runValidators: true },
    );

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    return profile;
  }

  async delete(userId: string): Promise<void> {
    const result = await this.profileModel.deleteOne({ userId: new Types.ObjectId(userId) });
    if (result.deletedCount === 0) {
      throw new NotFoundException('Profile not found');
    }
  }
}

function validateProfileMeasurements(profile: Partial<Profile>): void {
  const age = Number(profile.age);
  if (!Number.isInteger(age) || age < 13 || age > 100) {
    throw new BadRequestException('Age must be between 13 and 100.');
  }

  const weight = Number(profile.weight);
  const weightKg = profile.weightUnit === 'lbs' ? weight / 2.2046226218 : weight;
  if (!Number.isFinite(weightKg) || weightKg < 25 || weightKg > 350) {
    throw new BadRequestException('Weight must be between 25 and 350 kg (or the equivalent in lbs).');
  }

  const height = Number(profile.height);
  let heightCm: number;
  if (profile.heightUnit === 'cm') {
    heightCm = height;
  } else {
    const inches = Number(profile.heightInches);
    if (!Number.isInteger(height) || height < 2 || height > 8 || !Number.isFinite(inches) || inches < 0 || inches >= 12) {
      throw new BadRequestException('Height in ft & in. must have 2–8 feet and 0–11.9 inches.');
    }
    heightCm = (height * 12 + inches) * 2.54;
  }
  if (!Number.isFinite(heightCm) || heightCm < 80 || heightCm > 250) {
    throw new BadRequestException('Height must be between 80 and 250 cm (or the equivalent in ft & in.).');
  }

  const factor = profile.measurementUnit === 'inch' ? 2.54 : 1;
  for (const [field, max] of [['chest', 250], ['waist', 250], ['arms', 150]] as const) {
    const value = profile[field];
    if (value === undefined || value === null || value === '') continue;
    const cm = Number(value) * factor;
    if (!Number.isFinite(cm) || cm <= 0 || cm > max) {
      throw new BadRequestException(`${field} must be greater than 0 and no more than ${max} cm (or the equivalent in inches).`);
    }
  }
  if ((!profile.measurementUnit) && [profile.chest, profile.waist, profile.arms].some((value) => value !== undefined && value !== '')) {
    throw new BadRequestException('A measurement unit is required when body measurements are provided.');
  }

  if (profile.targetWeight !== undefined && profile.targetWeight !== null && profile.targetWeight !== '') {
    const targetWeight = Number(profile.targetWeight);
    const targetWeightKg = profile.weightUnit === 'lbs' ? targetWeight / 2.2046226218 : targetWeight;
    if (!Number.isFinite(targetWeightKg) || targetWeightKg < 25 || targetWeightKg > 350) {
      throw new BadRequestException('Target weight must be between 25 and 350 kg (or the equivalent in lbs).');
    }
  }
}

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 11000;
}
