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
var BackupDiskStorageService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BackupDiskStorageService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const child_process_1 = require("child_process");
const fs_1 = require("fs");
const path = __importStar(require("path"));
const util_1 = require("util");
const backup_config_1 = require("./backup-config");
const execFileAsync = (0, util_1.promisify)(child_process_1.execFile);
let BackupDiskStorageService = BackupDiskStorageService_1 = class BackupDiskStorageService {
    backupConfig;
    config;
    logger = new common_1.Logger(BackupDiskStorageService_1.name);
    constructor(backupConfig, config) {
        this.backupConfig = backupConfig;
        this.config = config;
    }
    async getOverview() {
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
    async resolveEmdadPaths() {
        const candidates = [
            this.backupConfig.storagePath,
            path.dirname(this.backupConfig.storagePath),
            '/var/lib/emdad-wms',
            '/var/www/emdad-sy-3pl-wms',
            '/var/www/emdad-sy-3pl-wms-staging',
            this.config.get('DOCUMENT_STORAGE_DIR')?.trim() || null,
            this.config.get('BACKUP_EMDAD_DISK_PATHS')?.trim() || null,
        ];
        const expanded = [];
        for (const raw of candidates) {
            if (!raw)
                continue;
            if (raw.includes(',')) {
                for (const part of raw.split(',')) {
                    const p = part.trim();
                    if (p)
                        expanded.push(path.resolve(p));
                }
                continue;
            }
            expanded.push(path.resolve(raw));
        }
        const existing = [];
        for (const p of [...new Set(expanded)]) {
            try {
                await fs_1.promises.access(p);
                existing.push(p);
            }
            catch {
            }
        }
        existing.sort((a, b) => a.length - b.length);
        const roots = [];
        for (const p of existing) {
            const nested = roots.some((root) => p === root || p.startsWith(`${root}${path.sep}`));
            if (!nested)
                roots.push(p);
        }
        return roots;
    }
    async readVolumeStats(targetPath) {
        try {
            const stats = await fs_1.promises.statfs(targetPath);
            const bsize = Number(stats.bsize);
            const blocks = Number(stats.blocks);
            const bavail = Number(stats.bavail);
            return {
                totalBytes: blocks * bsize,
                availableBytes: bavail * bsize,
                mountPath: targetPath,
            };
        }
        catch (err) {
            this.logger.warn(`statfs failed for ${targetPath}; falling back to df (${err instanceof Error ? err.message : String(err)})`);
            return this.readVolumeStatsViaDf(targetPath);
        }
    }
    async readVolumeStatsViaDf(targetPath) {
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
        if (!data)
            throw new Error('df returned no data');
        const parts = data.split(/\s+/);
        const size = Number(parts[0]);
        const avail = Number(parts[1]);
        const target = parts.slice(2).join(' ') || targetPath;
        if (!Number.isFinite(size) || !Number.isFinite(avail)) {
            throw new Error(`Unable to parse df output: ${data}`);
        }
        return { totalBytes: size, availableBytes: avail, mountPath: target };
    }
    async sumDirectoryBytes(paths) {
        let total = 0;
        for (const p of paths) {
            total += await this.directoryBytes(p);
        }
        return total;
    }
    async directoryBytes(dirPath) {
        try {
            const { stdout } = await execFileAsync('du', ['-sb', dirPath], {
                timeout: 60_000,
                maxBuffer: 2 * 1024 * 1024,
            });
            const first = stdout.trim().split(/\s+/)[0];
            const n = Number(first);
            return Number.isFinite(n) && n >= 0 ? n : 0;
        }
        catch (err) {
            this.logger.warn(`du failed for ${dirPath}: ${err instanceof Error ? err.message : String(err)}`);
            return 0;
        }
    }
};
exports.BackupDiskStorageService = BackupDiskStorageService;
exports.BackupDiskStorageService = BackupDiskStorageService = BackupDiskStorageService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [backup_config_1.BackupConfig,
        config_1.ConfigService])
], BackupDiskStorageService);
//# sourceMappingURL=backup-disk-storage.service.js.map