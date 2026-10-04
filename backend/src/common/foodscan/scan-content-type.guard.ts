import { Injectable, UnsupportedMediaTypeException, type CanActivate, type ExecutionContext } from '@nestjs/common';

/**
 * Rejects a scan body that was not sent as JSON.
 *
 * Without this the JSON parser silently ignores the payload, `req.body` arrives
 * empty, and the caller is told "image is required" for what is really a
 * content-type mistake. An absent header is allowed through so a bodiless POST
 * still fails on the missing image rather than on the media type.
 */
@Injectable()
export class ScanContentTypeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{ headers: Record<string, string | undefined> }>();
    const contentType = req.headers['content-type'];

    if (contentType !== undefined && !/^application\/(json|[\w.+-]+\+json)\b/i.test(contentType)) {
      throw new UnsupportedMediaTypeException(
        `Content-Type must be application/json, received ${contentType.split(';')[0].trim()}`
      );
    }
    return true;
  }
}
