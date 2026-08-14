import { createHash, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { isAbsolute, join, normalize, sep } from 'node:path';

import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type MediaKind = 'products' | 'avatars' | 'company-logos';

@Injectable()
export class MediaStorageService {
  private readonly baseDir: string;

  constructor(config: ConfigService) {
    const configured = (config.get<string>('MEDIA_STORAGE_DIR') ?? '').trim();
    this.baseDir = configured
      ? isAbsolute(configured)
        ? configured
        : join(process.cwd(), configured)
      : join(process.cwd(), 'storage', 'media');
  }

  absolutePath(relativePath: string): string {
    const cleaned = relativePath.replace(/^[/\\]+/, '');
    const full = normalize(join(this.baseDir, cleaned));
    const base = normalize(this.baseDir);
    if (full !== base && !full.startsWith(base + sep)) {
      throw new NotFoundException('Media file not found.');
    }
    return full;
  }

  async write(
    kind: MediaKind,
    companyId: string,
    buffer: Buffer,
  ): Promise<{ relativePath: string; byteSize: number; hash: string }> {
    const dir = join(this.baseDir, kind, companyId);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
    const fileName = `${randomUUID()}.webp`;
    const absolute = join(dir, fileName);
    await writeFile(absolute, buffer);
    const relativePath = join(kind, companyId, fileName).split(sep).join('/');
    return {
      relativePath,
      byteSize: buffer.byteLength,
      hash: createHash('sha256').update(buffer).digest('hex'),
    };
  }

  async remove(relativePath: string | null | undefined): Promise<void> {
    if (!relativePath?.trim()) return;
    const absolute = this.absolutePath(relativePath.trim());
    try {
      await unlink(absolute);
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT') throw err;
    }
  }
}
