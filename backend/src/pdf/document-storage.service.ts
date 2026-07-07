import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentType } from '@prisma/client';

export interface StoredFile {
  fileName: string;
  filePath: string;
  hash: string;
  fileSize: number;
}

/** Writes generated PDFs to immutable, per-type folders and returns metadata. */
@Injectable()
export class DocumentStorageService {
  private readonly baseDir: string;

  private readonly subdir: Record<DocumentType, string> = {
    [DocumentType.grn]: 'grn',
    [DocumentType.delivery_note]: 'delivery-notes',
    [DocumentType.final_contract]: 'final-contracts',
  };

  constructor(config: ConfigService) {
    const configured = (config.get<string>('DOCUMENT_STORAGE_DIR') ?? '').trim();
    this.baseDir = configured
      ? isAbsolute(configured)
        ? configured
        : join(process.cwd(), configured)
      : join(process.cwd(), 'storage', 'documents');
  }

  async write(type: DocumentType, fileName: string, buffer: Buffer): Promise<StoredFile> {
    const dir = join(this.baseDir, this.subdir[type]);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
    const filePath = join(dir, fileName);
    await writeFile(filePath, buffer, { flag: 'wx' }).catch(async (err: NodeJS.ErrnoException) => {
      // wx fails if the immutable file already exists — keep the original.
      if (err.code !== 'EEXIST') throw err;
    });
    const hash = createHash('sha256').update(buffer).digest('hex');
    return { fileName, filePath, hash, fileSize: buffer.byteLength };
  }

  /** Overwrite an existing PDF (explicit user re-generation with the latest template). */
  async replace(type: DocumentType, fileName: string, buffer: Buffer): Promise<StoredFile> {
    const dir = join(this.baseDir, this.subdir[type]);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
    const filePath = join(dir, fileName);
    await writeFile(filePath, buffer);
    const hash = createHash('sha256').update(buffer).digest('hex');
    return { fileName, filePath, hash, fileSize: buffer.byteLength };
  }
}
