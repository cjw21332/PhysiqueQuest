import { Injectable, type ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { enforceVerification } from './email-verification.js';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  async canActivate(context: ExecutionContext) {
    const allowed = await super.canActivate(context);
    if (!allowed) return false;
    const request = context.switchToHttp().getRequest();
    enforceVerification(request.user, String(request.route?.path ?? request.path));
    return true;
  }
}
