"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BackupDownloadTokenService = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const backup_config_1 = require("./backup-config");
let BackupDownloadTokenService = class BackupDownloadTokenService {
    backupConfig;
    constructor(backupConfig) {
        this.backupConfig = backupConfig;
    }
    issue(jobId, userId) {
        const ttl = this.backupConfig.downloadTokenTtlSec;
        const exp = Math.floor(Date.now() / 1000) + ttl;
        const token = this.sign({ jobId, userId, exp });
        return {
            token,
            expiresAt: new Date(exp * 1000).toISOString(),
            expiresInSec: ttl,
        };
    }
    verify(token, jobId, userId) {
        const payload = this.parseAndVerify(token);
        if (payload.jobId !== jobId || payload.userId !== userId) {
            throw new common_1.UnauthorizedException('Invalid download token.');
        }
        if (payload.exp < Math.floor(Date.now() / 1000)) {
            throw new common_1.UnauthorizedException('Download token has expired.');
        }
    }
    buildDownloadUrl(jobId, token, apiBasePath = '/api') {
        const q = new URLSearchParams({ token });
        return `${apiBasePath}/backups/${jobId}/download?${q.toString()}`;
    }
    sign(payload) {
        const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
        const sig = (0, crypto_1.createHmac)('sha256', this.backupConfig.signingSecret)
            .update(body)
            .digest('base64url');
        return `${body}.${sig}`;
    }
    parseAndVerify(token) {
        const parts = token.split('.');
        if (parts.length !== 2) {
            throw new common_1.UnauthorizedException('Invalid download token.');
        }
        const [body, sig] = parts;
        const expected = (0, crypto_1.createHmac)('sha256', this.backupConfig.signingSecret)
            .update(body)
            .digest('base64url');
        const a = Buffer.from(sig);
        const b = Buffer.from(expected);
        if (a.length !== b.length || !(0, crypto_1.timingSafeEqual)(a, b)) {
            throw new common_1.UnauthorizedException('Invalid download token.');
        }
        try {
            return JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
        }
        catch {
            throw new common_1.UnauthorizedException('Invalid download token.');
        }
    }
};
exports.BackupDownloadTokenService = BackupDownloadTokenService;
exports.BackupDownloadTokenService = BackupDownloadTokenService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [backup_config_1.BackupConfig])
], BackupDownloadTokenService);
//# sourceMappingURL=backup-download-token.service.js.map