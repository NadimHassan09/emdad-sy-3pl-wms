import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { scryptSync, timingSafeEqual } from 'node:crypto';

const SCRYPT_PREFIX = 'scrypt1$';

function verifyScrypt(plain: string, stored: string): boolean {
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'scrypt1') return false;
  const salt = Buffer.from(parts[2], 'base64url');
  const expected = Buffer.from(parts[3], 'base64url');
  const key = scryptSync(plain, salt, expected.length);
  return timingSafeEqual(key, expected);
}

@Injectable()
export class PasswordService {
  private readonly bcryptRounds = 12;

  async hash(plain: string): Promise<string> {
    return bcrypt.hash(plain, this.bcryptRounds);
  }

  /** Supports bcrypt (`$2a$` / `$2b$`) and legacy `scrypt1$…` hashes. */
  async verify(plain: string, stored: string): Promise<boolean> {
    if (!stored) return false;
    if (stored.startsWith(SCRYPT_PREFIX)) {
      return verifyScrypt(plain, stored);
    }
    if (stored.startsWith('$2')) {
      return bcrypt.compare(plain, stored);
    }
    return false;
  }

  isLegacyScrypt(stored: string): boolean {
    return stored.startsWith(SCRYPT_PREFIX);
  }
}
