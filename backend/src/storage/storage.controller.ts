import { Body, Controller, Get, Post, Put, Param, Req, Res, UseGuards, NotFoundException, PayloadTooLargeException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { StorageService } from './storage.service.js';
import { LocalStorageProvider, MAX_UPLOAD_BYTES } from './storage-provider.js';
import { UploadDto } from './dto/upload.dto.js';
@Controller('storage')
export class StorageController {
  constructor(private readonly storage: StorageService) {}
  @Post('uploads') @UseGuards(JwtAuthGuard)
  create(@Req() req: { user: { userId: string } }, @Body() dto: UploadDto) { return this.storage.createUpload(req.user.userId, dto.contentType, dto.size); }
  @Post('uploads/:id/complete') @UseGuards(JwtAuthGuard)
  complete(@Req() req: { user: { userId: string } }, @Param('id') id: string) { return this.storage.verify(id, req.user.userId); }
  @Get('uploads/:id/download') @UseGuards(JwtAuthGuard)
  download(@Req() req: { user: { userId: string } }, @Param('id') id: string) { return this.storage.download(id, req.user.userId); }
  private authorize(method: string, key: string, expires: string, signature: string) {
    if (!(this.storage.provider instanceof LocalStorageProvider) || !this.storage.provider.authorize(method, key, expires, signature)) throw new NotFoundException();
  }
  @Put('local/:key/:expires/:signature')
  async uploadLocal(@Req() req: Request, @Param('key') key: string, @Param('expires') expires: string, @Param('signature') signature: string) {
    this.authorize('PUT', key, expires, signature);
    const chunks: Buffer[] = []; let size = 0;
    for await (const chunk of req) { size += chunk.length; if (size > MAX_UPLOAD_BYTES) throw new PayloadTooLargeException(); chunks.push(Buffer.from(chunk)); }
    await this.storage.writeLocal(key, Buffer.concat(chunks)); return { uploaded: true };
  }
  @Get('local/:key/:expires/:signature')
  async downloadLocal(@Param('key') key: string, @Param('expires') expires: string, @Param('signature') signature: string, @Res() res: Response) {
    this.authorize('GET', key, expires, signature);
    const result = await this.storage.readLocal(key); res.setHeader('Content-Type', result.contentType); res.setHeader('Content-Disposition', 'attachment'); res.send(result.bytes);
  }
}
