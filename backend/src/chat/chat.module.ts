import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Profile, ProfileSchema } from '../profile/schemas/profile.schema.js';
import { Nutrition, NutritionSchema } from '../nutrition/schemas/nutrition.schema.js';
import { WorkoutSession, WorkoutSessionSchema } from '../workouts/schemas/workout-session.schema.js';
import { Activity, ActivitySchema } from '../activity/schemas/activity.schema.js';
import { CoachProgram, CoachProgramSchema } from '../coach/coach-program.schema.js';
import { ProgressEntry, ProgressEntrySchema } from '../progress/schemas/progress-entry.schema.js';
import { Settings, SettingsSchema } from '../settings/schemas/settings.schema.js';
import { ActivityModule } from '../activity/activity.module.js';
import { WorkoutsModule } from '../workouts/workouts.module.js';
import { ChatController } from './chat.controller.js';
import { ChatService } from './chat.service.js';
import { ChatContextService } from './chat-context.service.js';
import { ChatRateLimitGuard } from './chat-rate-limit.guard.js';
import { LocalChatProvider } from './local-chat.provider.js';
import { Notifications, NotificationsSchema } from '../notifications/schemas/notification.schema.js';
import { AlertEvent, AlertEventSchema } from '../safety/schemas/alert-event.schema.js';
import { AuthRateLimit, AuthRateLimitSchema } from '../auth/auth-rate-limit.schema.js';

@Module({ imports: [MongooseModule.forFeature([
  { name: Profile.name, schema: ProfileSchema }, { name: Nutrition.name, schema: NutritionSchema },
  { name: WorkoutSession.name, schema: WorkoutSessionSchema }, { name: Activity.name, schema: ActivitySchema },
  { name: CoachProgram.name, schema: CoachProgramSchema }, { name: ProgressEntry.name, schema: ProgressEntrySchema },
  { name: Settings.name, schema: SettingsSchema },
  { name: Notifications.name, schema: NotificationsSchema }, { name: AlertEvent.name, schema: AlertEventSchema },
  { name: AuthRateLimit.name, schema: AuthRateLimitSchema },
]), ActivityModule, WorkoutsModule], controllers: [ChatController], providers: [ChatService, ChatContextService, LocalChatProvider, ChatRateLimitGuard] })
export class ChatModule {}
