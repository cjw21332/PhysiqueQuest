import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { MealDto, WaterDto } from '../src/nutrition/dto/nutrition.dto.js';
import { UpdateSettingsDto } from '../src/settings/dto/settings.dto.js';

describe('nutrition and settings request validation', () => {
  it('rejects an impossible water-log calendar date', async () => {
    const dto = plainToInstance(WaterDto, { date: '2026-02-30', glasses: 2 });
    const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
    expect(errors.some(error => error.property === 'date')).toBe(true);
  });

  it('rejects negative calories and an empty food name', async () => {
    const dto = plainToInstance(MealDto, { name: '  ', meal: 'Lunch', calories: -1 });
    const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
    expect(errors.some(error => error.property === 'name')).toBe(true);
    expect(errors.some(error => error.property === 'calories')).toBe(true);
  });

  it('validates settings fields and forbids unknown nested keys', async () => {
    const dto = plainToInstance(UpdateSettingsDto, {
      values: { threshold: 45, inactivity: true, experimentalAdmin: true },
    });
    const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
    expect(errors.some(error => error.property === 'values')).toBe(true);
  });

  it('accepts the supported settings shape', async () => {
    const dto = plainToInstance(UpdateSettingsDto, {
      values: { threshold: 60, inactivity: false, alarmVolume: true, showLeaderboard: false },
    });
    expect(await validate(dto, { whitelist: true, forbidNonWhitelisted: true })).toEqual([]);
  });
});
