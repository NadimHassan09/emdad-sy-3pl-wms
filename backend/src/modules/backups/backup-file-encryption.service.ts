import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const MAGIC = Buffer.from('EMDADBK1');

@Injectable()
export class BackupFileEncryptionService {
  constructor(private readonly config: ConfigService) {}

  /**
   * Encrypts a plain `.dump` to `.dump.enc` (AES-256-GCM).
   * Format: MAGIC(8) + IV(12) + ciphertext + authTag(16)
   */
  async encryptDumpFile(sourcePath: string, targetPath: string): Promise<number> {
    const key = this.resolveKey();
    const iv = randomBytes(IV_BYTES);
    const plain = await readFile(sourcePath);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
    const authTag = cipher.getAuthTag();
    const output = Buffer.concat([MAGIC, iv, encrypted, authTag]);
    await writeFile(targetPath, output, { mode: 0o600 });
    return output.length;
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
