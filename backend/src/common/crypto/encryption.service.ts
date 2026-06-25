import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const PREFIX = 'v1';

@Injectable()
export class EncryptionService {
  constructor(private readonly config: ConfigService) {}

  encrypt(plaintext: string): string {
    const key = this.resolveKey();
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return [
      PREFIX,
      iv.toString('base64url'),
      authTag.toString('base64url'),
      encrypted.toString('base64url'),
    ].join(':');
  }

  decrypt(ciphertext: string): string {
    const key = this.resolveKey();
    const parts = ciphertext.split(':');
    if (parts.length !== 4 || parts[0] !== PREFIX) {
      throw new Error('Unsupported ciphertext format.');
    }
    const [, ivB64, tagB64, dataB64] = parts;
    const iv = Buffer.from(ivB64, 'base64url');
    const authTag = Buffer.from(tagB64, 'base64url');
    const encrypted = Buffer.from(dataB64, 'base64url');
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  }

  private resolveKey(): Buffer {
    const raw = this.config.get<string>('BACKUP_ENCRYPTION_KEY')?.trim();
    if (!raw) {
      throw new ServiceUnavailableException(
        'BACKUP_ENCRYPTION_KEY is not configured (32-byte base64 key required).',
      );
    }
    const key = Buffer.from(raw, 'base64');
    if (key.length !== 32) {
      throw new ServiceUnavailableException(
        'BACKUP_ENCRYPTION_KEY must decode to exactly 32 bytes.',
      );
    }
    return key;
  }
}
