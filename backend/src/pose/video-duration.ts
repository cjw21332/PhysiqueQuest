// Reads ISO BMFF movie metadata without decoding or retaining the video.
export function videoDuration(bytes: Buffer): number | null {
  const find = (start: number, end: number, target: string): [number, number] | null => {
    for (let offset = start; offset + 8 <= end;) {
      let size = bytes.readUInt32BE(offset);
      const type = bytes.toString('ascii', offset + 4, offset + 8);
      let header = 8;
      if (size === 1) {
        if (offset + 16 > end) return null;
        const extended = bytes.readBigUInt64BE(offset + 8);
        if (extended > BigInt(Number.MAX_SAFE_INTEGER)) return null;
        size = Number(extended); header = 16;
      } else if (size === 0) size = end - offset;
      if (size < header || offset + size > end) return null;
      if (type === target) return [offset + header, offset + size];
      offset += size;
    }
    return null;
  };
  const moov = find(0, bytes.length, 'moov');
  const mvhd = moov && find(moov[0], moov[1], 'mvhd');
  if (!mvhd || mvhd[0] + 20 > mvhd[1]) return null;
  const version = bytes[mvhd[0]];
  const position = mvhd[0] + (version === 0 ? 12 : version === 1 ? 20 : 0);
  if (!position || position + (version === 1 ? 12 : 8) > mvhd[1]) return null;
  const scale = bytes.readUInt32BE(position);
  const ticks = version === 1 ? Number(bytes.readBigUInt64BE(position + 4)) : bytes.readUInt32BE(position + 4);
  const seconds = ticks / scale;
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
}
