import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { open, appendFile, unlink, rename } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
const MAGIC = Buffer.from('PQBACK01');
export function backupKey(value) {
  const key = Buffer.from(value || '', 'base64');
  if (key.length !== 32 || key.toString('base64') !== value) throw new Error('Configure a canonical base64 32-byte BACKUP_ENCRYPTION_KEY');
  return key;
}
export async function encryptBackup(source, target, key) {
  const iv = randomBytes(12), file = await open(target, 'wx', 0o600);
  await file.write(Buffer.concat([MAGIC, iv])); await file.close();
  try {
    const cipher = createCipheriv('aes-256-gcm', key, iv); cipher.setAAD(MAGIC);
    await pipeline(createReadStream(source), cipher, createWriteStream(target, { flags: 'a' }));
    await appendFile(target, cipher.getAuthTag());
  } catch { await unlink(target).catch(() => {}); throw new Error('Backup encryption failed'); }
}
export async function decryptBackup(source, target, key) {
  const file = await open(source, 'r'); let iv, tag, size;
  try {
    size = (await file.stat()).size;
    const header = Buffer.alloc(20); await file.read(header, 0, 20, 0);
    if (size < 36 || !header.subarray(0, 8).equals(MAGIC)) throw new Error('Invalid encrypted backup');
    iv = header.subarray(8); tag = Buffer.alloc(16); await file.read(tag, 0, 16, size - 16);
  } finally { await file.close(); }
  const temporary = `${target}.${randomBytes(8).toString('hex')}.partial`;
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, iv); decipher.setAAD(MAGIC); decipher.setAuthTag(tag);
    await pipeline(createReadStream(source, { start: 20, end: size - 17 }), decipher, createWriteStream(temporary, { flags: 'wx', mode: 0o600 }));
    // Only authenticated plaintext becomes available to the restore command.
    const destination = await open(target, 'wx', 0o600); await destination.close();
    await rename(temporary, target);
  } catch { await unlink(temporary).catch(() => {}); throw new Error('Backup authentication failed'); }
}
