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
var BackupStorageService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BackupStorageService = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const path = __importStar(require("path"));
const backup_config_1 = require("./backup-config");
let BackupStorageService = BackupStorageService_1 = class BackupStorageService {
    backupConfig;
    logger = new common_1.Logger(BackupStorageService_1.name);
    constructor(backupConfig) {
        this.backupConfig = backupConfig;
    }
    async onModuleInit() {
        if (!this.backupConfig.enabled)
            return;
        await (0, promises_1.mkdir)(this.backupConfig.storagePath, { recursive: true, mode: 0o700 });
        this.logger.log(`Backup storage ready at ${this.backupConfig.storagePath}`);
    }
    jobDirectory(jobId) {
        return path.join(this.backupConfig.storagePath, jobId);
    }
    dumpPath(jobId) {
        return path.join(this.jobDirectory(jobId), `${jobId}.dump`);
    }
    manifestPath(jobId) {
        return path.join(this.jobDirectory(jobId), `${jobId}.manifest.json`);
    }
    async ensureJobDir(jobId) {
        const dir = this.jobDirectory(jobId);
        await (0, promises_1.mkdir)(dir, { recursive: true, mode: 0o700 });
        return dir;
    }
    async fileSize(filePath) {
        try {
            const s = await (0, promises_1.stat)(filePath);
            return s.size;
        }
        catch {
            return 0;
        }
    }
    async sha256File(filePath) {
        return new Promise((resolve, reject) => {
            const hash = (0, crypto_1.createHash)('sha256');
            const stream = (0, fs_1.createReadStream)(filePath);
            stream.on('data', (chunk) => hash.update(chunk));
            stream.on('end', () => resolve(hash.digest('hex')));
            stream.on('error', reject);
        });
    }
    async writeManifest(jobId, manifest) {
        const fs = await Promise.resolve().then(() => __importStar(require('fs/promises')));
        const p = this.manifestPath(jobId);
        await fs.writeFile(p, JSON.stringify(manifest, null, 2), { mode: 0o600 });
        return p;
    }
    async removeJobArtifacts(jobId) {
        const dump = this.dumpPath(jobId);
        const manifest = this.manifestPath(jobId);
        await (0, promises_1.unlink)(dump).catch(() => undefined);
        await (0, promises_1.unlink)(manifest).catch(() => undefined);
    }
    async jobArtifactBytes(jobId) {
        const dump = await this.fileSize(this.dumpPath(jobId));
        const manifest = await this.fileSize(this.manifestPath(jobId));
        return dump + manifest;
    }
    async removeJobDirectory(jobId) {
        const bytes = await this.jobArtifactBytes(jobId);
        await this.removeJobArtifacts(jobId);
        await (0, promises_1.rm)(this.jobDirectory(jobId), { recursive: true, force: true }).catch(() => undefined);
        return bytes;
    }
    async sumStorageBytes() {
        if (!this.backupConfig.enabled)
            return 0;
        let total = 0;
        let entries;
        try {
            entries = await (0, promises_1.readdir)(this.backupConfig.storagePath, { withFileTypes: true });
        }
        catch {
            return 0;
        }
        for (const entry of entries) {
            const name = String(entry.name);
            const entryPath = path.join(this.backupConfig.storagePath, name);
            if (entry.isFile()) {
                total += await this.fileSize(entryPath);
                continue;
            }
            if (!entry.isDirectory())
                continue;
            let files;
            try {
                files = await (0, promises_1.readdir)(entryPath, { withFileTypes: true });
            }
            catch {
                continue;
            }
            for (const file of files) {
                if (!file.isFile())
                    continue;
                total += await this.fileSize(path.join(entryPath, String(file.name)));
            }
        }
        return total;
    }
    resolveDumpPath(artifactPath, dumpFilename, jobId) {
        if (artifactPath && dumpFilename) {
            return path.join(artifactPath, dumpFilename);
        }
        return this.dumpPath(jobId);
    }
};
exports.BackupStorageService = BackupStorageService;
exports.BackupStorageService = BackupStorageService = BackupStorageService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [backup_config_1.BackupConfig])
], BackupStorageService);
//# sourceMappingURL=backup-storage.service.js.map