import { HttpException } from '@nestjs/common';
export function assertLegacyAuthEnabled() {
  if (process.env.LEGACY_AUTH_ENABLED === 'false') throw new HttpException({ code: 'APP_UPDATE_REQUIRED', message: 'Update the app and sign in again.' }, 426);
}
