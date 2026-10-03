import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ActivityController } from './activity.controller.js';
import { ActivityService } from './activity.service.js';
import { Activity, ActivitySchema } from './schemas/activity.schema.js';
@Module({ imports: [MongooseModule.forFeature([{ name: Activity.name, schema: ActivitySchema }])], controllers: [ActivityController], providers: [ActivityService] })
export class ActivityModule {}
