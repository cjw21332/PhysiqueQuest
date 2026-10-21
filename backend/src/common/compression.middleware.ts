import { gzip } from 'node:zlib';
import type { NextFunction, Request, Response } from 'express';

export function compressionMiddleware(req: Request, res: Response, next: NextFunction) {
  res.vary('Accept-Encoding');
  const send = res.send.bind(res);
  res.send = (body: unknown) => {
    if (req.method === 'HEAD' || /^\/api\/(?:v1\/)?auth(?:\/|$)/i.test(req.path) || !req.get('accept-encoding') || !req.acceptsEncodings('gzip') || res.getHeader('Content-Encoding') || (typeof body !== 'string' && !Buffer.isBuffer(body)) || Buffer.byteLength(body) < 1024) return send(body);
    if (!res.getHeader('Content-Type')) res.type(typeof body === 'string' ? 'html' : 'application/octet-stream');
    gzip(body, (error, compressed) => {
      if (res.destroyed) return;
      if (error) { next(error); return; }
      res.removeHeader('Content-Length'); res.setHeader('Content-Encoding', 'gzip'); send(compressed);
    });
    return res;
  };
  next();
}
