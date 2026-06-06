import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { createHash } from 'crypto';
import { createReadStream } from 'fs';
import { mkdir, readdir, rm, stat, unlink } from 'fs/promises';
import * as path from 'path';

import { BackupConfig } from './backup-config';

export type BackupManifest = {
  backupId: string;
  type: string;
  label: string | null;
  environmentId: string;
  dbName: string;
  pgVersion: string | null;
  schemaMigration: string | null;
  sizeBytes: number;
  checksumSha256: string;
  dumpFilename: string;
  createdAt: string;
  createdByUserId: string;
  createdByEmail: string;
};

@Injectable()
export class BackupStorageService implements OnModuleInit {
  private readonly logger = new Logger(BackupStorageService.name);

  constructor(private readonly backupConfig: BackupConfig) {}

  async onModuleInit(): Promise<void> {
    if (!this.backupConfig.enabled) return;
    await mkdir(this.backupConfig.storagePath, { recursive: true, mode: 0o700 });
    this.logger.log(`Backup storage ready at ${this.backupConfig.storagePath}`);
  }

  jobDirectory(jobId: string): string {
    return path.join(this.backupConfig.storagePath, jobId);
  }

  dumpPath(jobId: string): string {
    return path.join(this.jobDirectory(jobId), `${jobId}.dump`);
  }

  manifestPath(jobId: string): string {
    return path.join(this.jobDirectory(jobId), `${jobId}.manifest.json`);
  }

  async ensureJobDir(jobId: string): Promise<string> {
    const dir = this.jobDirectory(jobId);
    await mkdir(dir, { recursive: true, mode: 0o700 });
    return dir;
  }

  async fileSize(filePath: string): Promise<number> {
    try {
      const s = await stat(filePath);
      return s.size;
    } catch {
      return 0;
    }
  }

  async sha256File(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = createHash('sha256');
      const stream = createReadStream(filePath);
      stream.on('data', (chunk) => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  async writeManifest(jobId: string, manifest: BackupManifest): Promise<string> {
    const fs = await import('fs/promises');
    const p = this.manifestPath(jobId);
    await fs.writeFile(p, JSON.stringify(manifest, null, 2), { mode: 0o600 });
    return p;
  }

  async removeJobArtifacts(jobId: string): Promise<void> {
    const dump = this.dumpPath(jobId);
    const manifest = this.manifestPath(jobId);
    await unlink(dump).catch(() => undefined);
    await unlink(manifest).catch(() => undefined);
  }

  /** Sum on-disk bytes for dump + manifest before deletion. */
  async jobArtifactBytes(jobId: string): Promise<number> {
    const dump = await this.fileSize(this.dumpPath(jobId));
    const manifest = await this.fileSize(this.manifestPath(jobId));
    return dump + manifest;
  }

  /** Remove dump, manifest, and job directory; returns bytes reclaimed. */
  async removeJobDirectory(jobId: string): Promise<number> {
    const bytes = await this.jobArtifactBytes(jobId);
    await this.removeJobArtifacts(jobId);
    await rm(this.jobDirectory(jobId), { recursive: true, force: true }).catch(() => undefined);
    return bytes;
  }

  /** Sum bytes of all files under the backup storage root (one level of job directories). */
  async sumStorageBytes(): Promise<number> {
    if (!this.backupConfig.enabled) return 0;

    let total = 0;
    let entries;
    try {
      entries = await readdir(this.backupConfig.storagePath, { withFileTypes: true });
    } catch {
      return 0;
    }

    for (const entry of entries) {
      const name = String(entry.name);
      const entryPath = path.join(this.backupConfig.storagePath, name);
      if (entry.isFile()) {
        total += await this.fileSize(entryPath);
        continue;
      }
      if (!entry.isDirectory()) continue;

      let files;
      try {
        files = await readdir(entryPath, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const file of files) {
        if (!file.isFile()) continue;
        total += await this.fileSize(path.join(entryPath, String(file.name)));
      }
    }

    return total;
  }

  resolveDumpPath(artifactPath: string | null, dumpFilename: string | null, jobId: string): string {
    if (artifactPath && dumpFilename) {
      return path.join(artifactPath, dumpFilename);
    }
    return this.dumpPath(jobId);
  }
}
