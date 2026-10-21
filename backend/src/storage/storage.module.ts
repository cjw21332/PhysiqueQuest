import { Global, Module } from '@nestjs/common';
import { StorageService } from './storage.service.js';
import { StorageController } from './storage.controller.js';
@Global()
@Module({ controllers: [StorageController], providers: [StorageService], exports: [StorageService] })
export class StorageModule {}
