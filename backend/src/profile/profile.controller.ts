import { Controller, Get, Post, Put, Delete, Body, UseGuards, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ProfileService } from './profile.service.js';
import { CreateProfileDto, UpdateProfileDto } from './dto/profile.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { IsString, MaxLength, Matches } from 'class-validator';

class ProfilePhotoDto {
  @IsString() @MaxLength(700000) @Matches(/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/) photo: string;
}

type AuthenticatedRequest = Request & { user: { userId: string } };

@Controller('profile')
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Post()
  async create(@Req() req: AuthenticatedRequest, @Body() createProfileDto: CreateProfileDto) {
    return this.profileService.create(req.user.userId, createProfileDto);
  }

  @Get()
  async findOne(@Req() req: AuthenticatedRequest) {
    return this.profileService.findByUserId(req.user.userId);
  }

  @Put()
  async update(@Req() req: AuthenticatedRequest, @Body() updateProfileDto: UpdateProfileDto) {
    return this.profileService.update(req.user.userId, updateProfileDto);
  }

  @Put('photo')
  async photo(@Req() req: AuthenticatedRequest, @Body() body: ProfilePhotoDto) { return this.profileService.updatePhoto(req.user.userId, body.photo); }

  @Delete('photo')
  async removePhoto(@Req() req: AuthenticatedRequest) { return this.profileService.updatePhoto(req.user.userId, ''); }

  @Delete()
  async delete(@Req() req: AuthenticatedRequest) {
    return this.profileService.delete(req.user.userId);
  }
}
