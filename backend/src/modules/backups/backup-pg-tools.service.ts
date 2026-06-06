import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { spawn } from 'child_process';
import { constants } from 'fs';
import { access } from 'fs/promises';

import { PrismaService } from '../../common/prisma/prisma.service';
import { BackupConfig } from './backup-config';

@Injectable()
export class BackupPgToolsService {
  private readonly logger = new Logger(BackupPgToolsService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly backupConfig: BackupConfig,
  ) {}

  getDatabaseUrl(): string {
    const url = this.config.get<string>('DATABASE_URL');
    if (!url) throw new Error('DATABASE_URL is not configured.');
    return url;
  }

  sanitizeUrlForPgTools(databaseUrl: string): string {
    try {
      const u = new URL(databaseUrl);
      u.search = '';
      u.hash = '';
      return u.toString();
    } catch {
      return databaseUrl.split('?')[0] ?? databaseUrl;
    }
  }

  parseDbName(databaseUrl: string): string {
    try {
      const u = new URL(databaseUrl);
      return u.pathname.replace(/^\//, '') || 'postgres';
    } catch {
      return 'postgres';
    }
  }

  async terminateOtherSessions(dbName: string): Promise<void> {
    await this.prisma.$executeRaw(
      Prisma.sql`
        SELECT pg_terminate_backend(a.pid)
        FROM pg_stat_activity a
        WHERE a.datname = ${dbName}
          AND a.pid <> pg_backend_pid()
          AND a.pid IS NOT NULL
      `,
    );
  }

  async runPgDump(
    dumpPath: string,
    onProgress?: (bytesWritten: number) => void,
    estimatedBytes = 0,
  ): Promise<void> {
    const databaseUrl = this.sanitizeUrlForPgTools(this.getDatabaseUrl());
    const pgDump = await this.resolveExecutable(this.backupConfig.pgDumpPath, 'pg_dump');

    await new Promise<void>((resolve, reject) => {
      const args = ['--dbname', databaseUrl, '-Fc', '--no-owner', '--no-acl', '-f', dumpPath];
      const child = spawn(pgDump, args, {
        env: { ...process.env },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stderr = '';
      child.stderr?.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      const poll =
        onProgress &&
        setInterval(() => {
          void import('fs/promises').then((fs) =>
            fs.stat(dumpPath).then(
              (s) => onProgress(s.size),
              () => onProgress(0),
            ),
          );
        }, 800);

      child.on('error', (e) => {
        if (poll) clearInterval(poll);
        reject(e);
      });

      child.on('close', (code) => {
        if (poll) clearInterval(poll);
        if (code === 0) resolve();
        else reject(new Error(stderr.trim() || `pg_dump exited with code ${code}`));
      });
    });
  }

  async validateDumpFile(dumpPath: string): Promise<{ valid: boolean; error?: string; tocEntries?: number }> {
    let pgRestore: string;
    try {
      pgRestore = await this.resolveExecutable(this.backupConfig.pgRestorePath, 'pg_restore');
    } catch (err) {
      return {
        valid: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }

    return new Promise((resolve) => {
      const args = ['--list', dumpPath];
      const child = spawn(pgRestore, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';
      child.stdout?.on('data', (c: Buffer) => {
        stdout += c.toString();
      });
      child.stderr?.on('data', (c: Buffer) => {
        stderr += c.toString();
      });

      child.on('close', (code) => {
        if (code !== 0) {
          resolve({ valid: false, error: stderr.trim() || `pg_restore --list exited ${code}` });
          return;
        }
        const tocEntries = stdout.split('\n').filter((l) => l.trim().length > 0).length;
        if (tocEntries < 1) {
          resolve({ valid: false, error: 'Dump file contains no restore entries.' });
          return;
        }
        resolve({ valid: true, tocEntries });
      });

      child.on('error', (e) => {
        resolve({ valid: false, error: e.message });
      });
    });
  }

  /**
   * Full DB replace: drop public schema (avoids partition --clean errors), recreate, pg_restore.
   */
  async runPgRestoreFullReplace(dumpPath: string): Promise<void> {
    const dbName = this.parseDbName(this.getDatabaseUrl());
    await this.terminateOtherSessions(dbName);

    await this.prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS analytics CASCADE`);
    await this.prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS public CASCADE`);
    await this.prisma.$executeRawUnsafe(`CREATE SCHEMA public`);
    await this.prisma.$executeRawUnsafe(`GRANT ALL ON SCHEMA public TO public`);
    await this.prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
    await this.prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS btree_gist`);
    await this.prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);

    await this.runPgRestore(dumpPath, false);
  }

  async runPgRestore(dumpPath: string, clean = true): Promise<void> {
    const databaseUrl = this.sanitizeUrlForPgTools(this.getDatabaseUrl());
    const dbName = this.parseDbName(this.getDatabaseUrl());
    const pgRestore = await this.resolveExecutable(this.backupConfig.pgRestorePath, 'pg_restore');

    await this.terminateOtherSessions(dbName);

    const args = ['--dbname', databaseUrl, '--no-owner', '--no-acl', '--exit-on-error'];
    if (clean) {
      args.push('--clean', '--if-exists');
    }
    args.push(dumpPath);

    await new Promise<void>((resolve, reject) => {
      const child = spawn(pgRestore, args, {
        env: { ...process.env },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stderr = '';
      child.stderr?.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      child.on('error', reject);
      child.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(stderr.trim() || `pg_restore exited with code ${code}`));
      });
    });
  }

  async runPrismaMigrateDeploy(): Promise<void> {
    const { execFile } = await import('child_process');
    const { promisify } = await import('util');
    const exec = promisify(execFile);
    const cwd = process.cwd();
    const { stdout, stderr } = await exec('npx', ['prisma', 'migrate', 'deploy'], {
      cwd,
      env: process.env,
      maxBuffer: 10 * 1024 * 1024,
    });
    if (stdout) this.logger.debug(stdout);
    if (stderr) this.logger.debug(stderr);
  }

  async runDbSeed(): Promise<void> {
    const { execFile } = await import('child_process');
    const { promisify } = await import('util');
    const exec = promisify(execFile);
    const cwd = process.cwd();
    await exec('npm', ['run', 'db:seed'], { cwd, env: process.env, maxBuffer: 10 * 1024 * 1024 });
  }

  async estimateDatabaseBytes(dbName: string): Promise<number> {
    const rows = await this.prisma.$queryRaw<{ bytes: bigint }[]>(
      Prisma.sql`SELECT pg_database_size(${dbName}::name) AS bytes`,
    );
    const bytes = rows[0]?.bytes;
    return bytes != null ? Number(bytes) : 0;
  }

  async queryPgVersion(): Promise<string | null> {
    const rows = await this.prisma.$queryRaw<{ version: string }[]>(
      Prisma.sql`SELECT version() AS version`,
    );
    return rows[0]?.version ?? null;
  }

  async latestMigrationName(): Promise<string | null> {
    const rows = await this.prisma.$queryRaw<{ migration_name: string }[]>(
      Prisma.sql`
        SELECT migration_name
        FROM _prisma_migrations
        WHERE finished_at IS NOT NULL
        ORDER BY finished_at DESC
        LIMIT 1
      `,
    );
    return rows[0]?.migration_name ?? null;
  }

  async reconnectPrisma(): Promise<void> {
    try {
      await this.prisma.$disconnect();
    } catch {
      // ignore
    }
    await this.prisma.$connect();
  }

  async invalidateAllSessions(): Promise<void> {
    await this.prisma.user.updateMany({ data: { tokenVersion: { increment: 1 } } });
    await this.prisma.authRefreshSession.deleteMany({});
  }

  /** PM2 often has no PATH — resolve bare names to /usr/bin when needed. */
  private async resolveExecutable(configured: string, fallbackName: string): Promise<string> {
    if (configured.includes('/')) {
      await access(configured, constants.X_OK);
      return configured;
    }
    const candidates = [
      `/usr/bin/${configured}`,
      `/usr/bin/${fallbackName}`,
      `/usr/local/bin/${fallbackName}`,
    ];
    for (const candidate of candidates) {
      try {
        await access(candidate, constants.X_OK);
        return candidate;
      } catch {
        // try next
      }
    }
    throw new Error(`${fallbackName} not found (configure BACKUP_PG_DUMP_PATH / BACKUP_PG_RESTORE_PATH).`);
  }
}
