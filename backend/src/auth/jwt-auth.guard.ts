import { ForbiddenException, Injectable, type ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { enforceVerification } from './email-verification.js';

export function initialPasswordRouteAllowed(method: string, url: string) {
  const path = url.split('?')[0].replace(/\/+$/, '');
  return (method === 'GET' && /^\/api\/(?:v1\/)?auth\/me$/.test(path)) ||
    (method === 'POST' && /^\/api\/(?:v1\/)?auth\/(?:logout|admin-initial-password)$/.test(path));
}

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  async canActivate(context: ExecutionContext) {
    const allowed = await super.canActivate(context);
    if (!allowed) return false;
    const request = context.switchToHttp().getRequest();
    enforceVerification(request.user, String(request.route?.path ?? request.path));
    if (request.user?.mustChangePassword) {
      if (!initialPasswordRouteAllowed(String(request.method), String(request.originalUrl ?? request.url ?? ''))) throw new ForbiddenException('Change the initial admin password before continuing.');
    }
    return true;
  }
}
