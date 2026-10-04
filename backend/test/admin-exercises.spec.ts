import 'reflect-metadata';
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Types, type Model } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';
import { RolesGuard } from '../src/auth/roles.guard.js';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard.js';
import { AdminExercisesController } from '../src/exercises/exercises.controller.js';
import { ExerciseDto } from '../src/exercises/dto/exercise.dto.js';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AdminExercisesService } from '../src/exercises/exercises.service.js';
import type { ExerciseRecord } from '../src/exercises/schemas/exercise.schema.js';

describe('admin exercise authorization and persistence', () => {
  it('guards routes with JWT and role authorization and rejects unknown fields', async () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, AdminExercisesController);
    expect(guards).toEqual(expect.arrayContaining([JwtAuthGuard, RolesGuard]));
    const dto = plainToInstance(ExerciseDto, { name: 'Press', group: 'Chest', role: 'admin' });
    expect(await validate(dto, { whitelist: true, forbidNonWhitelisted: true })).not.toEqual([]);
  });

  it('requires a database-backed admin role', () => {
    const reflector = { getAllAndOverride: () => ['admin'] } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    const request = { user: { role: 'user' } };
    const context: any = { getHandler: () => () => {}, getClass: () => class {}, switchToHttp: () => ({ getRequest: () => request }) };
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    request.user.role = 'admin';
    expect(guard.canActivate(context)).toBe(true);
  });

  it('creates and lists persistent records and scopes updates/deletes by ID', async () => {
    const record = { _id: new Types.ObjectId(), name: 'Bench press', status: 'draft' };
    const create = vi.fn().mockResolvedValue(record);
    const find = vi.fn().mockReturnValue({ sort: () => ({ limit: async () => [record] }) });
    const findOneAndUpdate = vi.fn().mockResolvedValue(record);
    const findOneAndDelete = vi.fn().mockResolvedValue(record);
    const service = new AdminExercisesService({ create, find, findOneAndUpdate, findOneAndDelete } as unknown as Model<ExerciseRecord>);
    expect(await service.create({ name: 'Bench press', group: 'Chest · Dumbbells' })).toBe(record);
    expect(await service.list(20)).toEqual([record]);
    await service.update(String(record._id), { status: 'published' });
    await service.remove(String(record._id));
    expect(findOneAndUpdate.mock.calls[0]?.[0]._id).toEqual(record._id);
    expect(findOneAndDelete.mock.calls[0]?.[0]._id).toEqual(record._id);
  });
});
