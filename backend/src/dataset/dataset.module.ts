import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RolesGuard } from '../auth/roles.guard.js';
import { DatasetAdminController } from './dataset-admin.controller.js';
import { DatasetController } from './dataset.controller.js';
import { DatasetService } from './dataset.service.js';
import { DatasetClip, DatasetClipPayload, DatasetClipPayloadSchema, DatasetClipSchema } from './schemas/dataset-clip.schema.js';
import { DatasetConsent, DatasetConsentSchema } from './schemas/dataset-consent.schema.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DatasetConsent.name, schema: DatasetConsentSchema },
      { name: DatasetClip.name, schema: DatasetClipSchema },
      { name: DatasetClipPayload.name, schema: DatasetClipPayloadSchema },
    ]),
  ],
  controllers: [DatasetController, DatasetAdminController],
  providers: [DatasetService, RolesGuard],
  exports: [DatasetService],
})
export class DatasetModule {}
