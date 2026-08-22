import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { execFile } from 'child_process';
import { promises as fs } from 'fs';
import * as path from 'path';
import { promisify } from 'util';

import { BackupConfig } from './backup-config';

const execFileAsync = promisify(execFile);

export type VpsDiskStorageOverview = {
  /** Bytes used by the Emdad system (app + backups + documents). */
  usedBytes: number;
  /** Bytes occupied by OS and other apps on the same volume. */
  reservedBytes: number;
  /** Free bytes available on the VPS volume. */
  availableBytes: number;
  /** Total size of the VPS volume. */
  totalBytes: number;
  /** Filesystem mount path used for the measurement. */
  mountPath: string;
  /** Absolute paths included in the Emdad "used" total. */
  emdadPaths: string[];
};

@Injectable()
export class BackupDiskStorageService {
  private readonly logger = new Logger(BackupDiskStorageService.name);

  constructor(
    private readonly backupConfig: BackupConfig,
    private readonly config: ConfigService,
  ) {}

  /**
   * Real VPS volume stats for the Backup Storage Overview card.
   * used = Emdad system footprint; reserved = everything else on the volume;
   * available = free space; total = volume capacity.
   */
  async getOverview(): Promise<VpsDiskStorageOverview> {
    const mountPath = this.backupConfig.storagePath;
    const volume = await this.readVolumeStats(mountPath);
    const emdadPaths = await this.resolveEmdadPaths();
    const usedBytes = await this.sumDirectoryBytes(emdadPaths);
    const occupiedBytes = Math.max(0, volume.totalBytes - volume.availableBytes);
    const reservedBytes = Math.max(0, occupiedBytes - usedBytes);

    return {
      usedBytes,
      reservedBytes,
      availableBytes: volume.availableBytes,
      totalBytes: volume.totalBytes,
      mountPath: volume.mountPath,
      emdadPaths,
    };
  }

  private async resolveEmdadPaths(): Promise<string[]> {
    const candidates = [
      this.backupConfig.storagePath,
      path.dirname(this.backupConfig.storagePath), // e.g. /var/lib/emdad-wms/backups → /var/lib/emdad-wms
      '/var/lib/emdad-wms',
      '/var/www/emdad-sy-3pl-wms',
      '/var/www/emdad-sy-3pl-wms-staging',
      this.config.get<string>('DOCUMENT_STORAGE_DIR')?.trim() || null,
      this.config.get<string>('BACKUP_EMDAD_DISK_PATHS')?.trim() || null,
    ];

    const expanded: string[] = [];
    for (const raw of candidates) {
      if (!raw) continue;
      if (raw.includes(',')) {
        for (const part of raw.split(',')) {
          const p = part.trim();
          if (p) expanded.push(path.resolve(p));
        }
        continue;
      }
      expanded.push(path.resolve(raw));
    }

    const existing: string[] = [];
    for (const p of [...new Set(expanded)]) {
      try {
        await fs.access(p);
        existing.push(p);
      } catch {
        // skip missing paths
      }
    }

    // Prefer parent roots: drop paths that are nested under another included path.
    existing.sort((a, b) => a.length - b.length);
    const roots: string[] = [];
    for (const p of existing) {
      const nested = roots.some((root) => p === root || p.startsWith(`${root}${path.sep}`));
      if (!nested) roots.push(p);
    }
    return roots;
  }

  private async readVolumeStats(targetPath: string): Promise<{
    totalBytes: number;
    availableBytes: number;
    mountPath: string;
  }> {
    try {
      const stats = await fs.statfs(targetPath);
      const bsize = Number(stats.bsize);
      const blocks = Number(stats.blocks);
      const bavail = Number(stats.bavail);
      return {
        totalBytes: blocks * bsize,
        availableBytes: bavail * bsize,
        mountPath: targetPath,
      };
    } catch (err) {
      this.logger.warn(
        `statfs failed for ${targetPath}; falling back to df (${err instanceof Error ? err.message : String(err)})`,
      );
      return this.readVolumeStatsViaDf(targetPath);
    }
  }

  private async readVolumeStatsViaDf(targetPath: string): Promise<{
    totalBytes: number;
    availableBytes: number;
    mountPath: string;
  }> {
    const { stdout } = await execFileAsync('df', ['-B1', '--output=size,avail,target', targetPath], {
      timeout: 10_000,
      maxBuffer: 1024 * 1024,
    });
    const lines = stdout
      .trim()
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    const data = lines[lines.length - 1];
    if (!data) throw new Error('df returned no data');
    const parts = data.split(/\s+/);
    const size = Number(parts[0]);
    const avail = Number(parts[1]);
    const target = parts.slice(2).join(' ') || targetPath;
    if (!Number.isFinite(size) || !Number.isFinite(avail)) {
      throw new Error(`Unable to parse df output: ${data}`);
    }
    return { totalBytes: size, availableBytes: avail, mountPath: target };
  }

  private async sumDirectoryBytes(paths: string[]): Promise<number> {
    let total = 0;
    for (const p of paths) {
      total += await this.directoryBytes(p);
    }
    return total;
  }

  private async directoryBytes(dirPath: string): Promise<number> {
    try {
      const { stdout } = await execFileAsync('du', ['-sb', dirPath], {
        timeout: 60_000,
        maxBuffer: 2 * 1024 * 1024,
      });
      const first = stdout.trim().split(/\s+/)[0];
      const n = Number(first);
      return Number.isFinite(n) && n >= 0 ? n : 0;
    } catch (err) {
      this.logger.warn(
        `du failed for ${dirPath}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return 0;
    }
  }
}
