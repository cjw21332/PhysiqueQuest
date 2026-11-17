import { Global, Module } from '@nestjs/common';
import { PrivacyController } from './privacy.controller.js';
import { PrivacyService } from './privacy.service.js';
import { AccountLifecycleFence } from './account-lifecycle-fence.js';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { LifecycleContextInterceptor } from './lifecycle-context.js';

@Global()
@Module({ controllers: [PrivacyController], providers: [PrivacyService, AccountLifecycleFence, { provide: APP_INTERCEPTOR, useClass: LifecycleContextInterceptor }], exports: [PrivacyService, AccountLifecycleFence] })
export class PrivacyModule {}
