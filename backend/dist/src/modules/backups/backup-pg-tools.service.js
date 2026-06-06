"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var BackupPgToolsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BackupPgToolsService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const client_1 = require("@prisma/client");
const child_process_1 = require("child_process");
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const backup_config_1 = require("./backup-config");
let BackupPgToolsService = BackupPgToolsService_1 = class BackupPgToolsService {
    config;
    prisma;
    backupConfig;
    logger = new common_1.Logger(BackupPgToolsService_1.name);
    constructor(config, prisma, backupConfig) {
        this.config = config;
        this.prisma = prisma;
        this.backupConfig = backupConfig;
    }
    getDatabaseUrl() {
        const url = this.config.get('DATABASE_URL');
        if (!url)
            throw new Error('DATABASE_URL is not configured.');
        return url;
    }
    sanitizeUrlForPgTools(databaseUrl) {
        try {
            const u = new URL(databaseUrl);
            u.search = '';
            u.hash = '';
            return u.toString();
        }
        catch {
            return databaseUrl.split('?')[0] ?? databaseUrl;
        }
    }
    parseDbName(databaseUrl) {
        try {
            const u = new URL(databaseUrl);
            return u.pathname.replace(/^\//, '') || 'postgres';
        }
        catch {
            return 'postgres';
        }
    }
    async terminateOtherSessions(dbName) {
        await this.prisma.$executeRaw(client_1.Prisma.sql `
        SELECT pg_terminate_backend(a.pid)
        FROM pg_stat_activity a
        WHERE a.datname = ${dbName}
          AND a.pid <> pg_backend_pid()
          AND a.pid IS NOT NULL
      `);
    }
    async runPgDump(dumpPath, onProgress, estimatedBytes = 0) {
        const databaseUrl = this.sanitizeUrlForPgTools(this.getDatabaseUrl());
        const pgDump = await this.resolveExecutable(this.backupConfig.pgDumpPath, 'pg_dump');
        await new Promise((resolve, reject) => {
            const args = ['--dbname', databaseUrl, '-Fc', '--no-owner', '--no-acl', '-f', dumpPath];
            const child = (0, child_process_1.spawn)(pgDump, args, {
                env: { ...process.env },
                stdio: ['ignore', 'pipe', 'pipe'],
            });
            let stderr = '';
            child.stderr?.on('data', (chunk) => {
                stderr += chunk.toString();
            });
            const poll = onProgress &&
                setInterval(() => {
                    void Promise.resolve().then(() => __importStar(require('fs/promises'))).then((fs) => fs.stat(dumpPath).then((s) => onProgress(s.size), () => onProgress(0)));
                }, 800);
            child.on('error', (e) => {
                if (poll)
                    clearInterval(poll);
                reject(e);
            });
            child.on('close', (code) => {
                if (poll)
                    clearInterval(poll);
                if (code === 0)
                    resolve();
                else
                    reject(new Error(stderr.trim() || `pg_dump exited with code ${code}`));
            });
        });
    }
    async validateDumpFile(dumpPath) {
        let pgRestore;
        try {
            pgRestore = await this.resolveExecutable(this.backupConfig.pgRestorePath, 'pg_restore');
        }
        catch (err) {
            return {
                valid: false,
                error: err instanceof Error ? err.message : String(err),
            };
        }
        return new Promise((resolve) => {
            const args = ['--list', dumpPath];
            const child = (0, child_process_1.spawn)(pgRestore, args, {
                stdio: ['ignore', 'pipe', 'pipe'],
            });
            let stdout = '';
            let stderr = '';
            child.stdout?.on('data', (c) => {
                stdout += c.toString();
            });
            child.stderr?.on('data', (c) => {
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
    async runPgRestoreFullReplace(dumpPath) {
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
    async runPgRestore(dumpPath, clean = true) {
        const databaseUrl = this.sanitizeUrlForPgTools(this.getDatabaseUrl());
        const dbName = this.parseDbName(this.getDatabaseUrl());
        const pgRestore = await this.resolveExecutable(this.backupConfig.pgRestorePath, 'pg_restore');
        await this.terminateOtherSessions(dbName);
        const args = ['--dbname', databaseUrl, '--no-owner', '--no-acl', '--exit-on-error'];
        if (clean) {
            args.push('--clean', '--if-exists');
        }
        args.push(dumpPath);
        await new Promise((resolve, reject) => {
            const child = (0, child_process_1.spawn)(pgRestore, args, {
                env: { ...process.env },
                stdio: ['ignore', 'pipe', 'pipe'],
            });
            let stderr = '';
            child.stderr?.on('data', (chunk) => {
                stderr += chunk.toString();
            });
            child.on('error', reject);
            child.on('close', (code) => {
                if (code === 0)
                    resolve();
                else
                    reject(new Error(stderr.trim() || `pg_restore exited with code ${code}`));
            });
        });
    }
    async runPrismaMigrateDeploy() {
        const { execFile } = await Promise.resolve().then(() => __importStar(require('child_process')));
        const { promisify } = await Promise.resolve().then(() => __importStar(require('util')));
        const exec = promisify(execFile);
        const cwd = process.cwd();
        const { stdout, stderr } = await exec('npx', ['prisma', 'migrate', 'deploy'], {
            cwd,
            env: process.env,
            maxBuffer: 10 * 1024 * 1024,
        });
        if (stdout)
            this.logger.debug(stdout);
        if (stderr)
            this.logger.debug(stderr);
    }
    async runDbSeed() {
        const { execFile } = await Promise.resolve().then(() => __importStar(require('child_process')));
        const { promisify } = await Promise.resolve().then(() => __importStar(require('util')));
        const exec = promisify(execFile);
        const cwd = process.cwd();
        await exec('npm', ['run', 'db:seed'], { cwd, env: process.env, maxBuffer: 10 * 1024 * 1024 });
    }
    async estimateDatabaseBytes(dbName) {
        const rows = await this.prisma.$queryRaw(client_1.Prisma.sql `SELECT pg_database_size(${dbName}::name) AS bytes`);
        const bytes = rows[0]?.bytes;
        return bytes != null ? Number(bytes) : 0;
    }
    async queryPgVersion() {
        const rows = await this.prisma.$queryRaw(client_1.Prisma.sql `SELECT version() AS version`);
        return rows[0]?.version ?? null;
    }
    async latestMigrationName() {
        const rows = await this.prisma.$queryRaw(client_1.Prisma.sql `
        SELECT migration_name
        FROM _prisma_migrations
        WHERE finished_at IS NOT NULL
        ORDER BY finished_at DESC
        LIMIT 1
      `);
        return rows[0]?.migration_name ?? null;
    }
    async reconnectPrisma() {
        try {
            await this.prisma.$disconnect();
        }
        catch {
        }
        await this.prisma.$connect();
    }
    async invalidateAllSessions() {
        await this.prisma.user.updateMany({ data: { tokenVersion: { increment: 1 } } });
        await this.prisma.authRefreshSession.deleteMany({});
    }
    async resolveExecutable(configured, fallbackName) {
        if (configured.includes('/')) {
            await (0, promises_1.access)(configured, fs_1.constants.X_OK);
            return configured;
        }
        const candidates = [
            `/usr/bin/${configured}`,
            `/usr/bin/${fallbackName}`,
            `/usr/local/bin/${fallbackName}`,
        ];
        for (const candidate of candidates) {
            try {
                await (0, promises_1.access)(candidate, fs_1.constants.X_OK);
                return candidate;
            }
            catch {
            }
        }
        throw new Error(`${fallbackName} not found (configure BACKUP_PG_DUMP_PATH / BACKUP_PG_RESTORE_PATH).`);
    }
};
exports.BackupPgToolsService = BackupPgToolsService;
exports.BackupPgToolsService = BackupPgToolsService = BackupPgToolsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        prisma_service_1.PrismaService,
        backup_config_1.BackupConfig])
], BackupPgToolsService);
//# sourceMappingURL=backup-pg-tools.service.js.map