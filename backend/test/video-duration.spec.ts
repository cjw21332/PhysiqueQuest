import { describe, expect, it } from 'vitest';
import { videoDuration } from '../src/pose/video-duration.js';
import { readFileSync } from 'node:fs';

const box = (type: string, body: Buffer) => { const header = Buffer.alloc(8); header.writeUInt32BE(body.length + 8); header.write(type, 4, 'ascii'); return Buffer.concat([header, body]); };
const movie = (seconds: number) => { const body = Buffer.alloc(20); body.writeUInt32BE(1000, 12); body.writeUInt32BE(seconds * 1000, 16); return box('moov', box('mvhd', body)); };

describe('video duration', () => {
  it('reads movie duration and rejects missing or malformed metadata', () => {
    expect(videoDuration(movie(120))).toBe(120);
    expect(videoDuration(movie(121))).toBe(121);
    expect(videoDuration(Buffer.from('broken'))).toBeNull();
    const invalid = movie(20); invalid.writeUInt32BE(9999, 0);
    expect(videoDuration(invalid)).toBeNull();
  });
  it('reads an actual MP4 used by the browser upload test', () => {
    const seconds = videoDuration(readFileSync(new URL('../../frontend/public/opening-app-animation.mp4', import.meta.url)));
    expect(seconds).toBeGreaterThan(0);
    expect(seconds).toBeLessThanOrEqual(120);
  });
});
