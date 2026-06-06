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
exports.BackupDriveAuthService = void 0;
const common_1 = require("@nestjs/common");
const node_crypto_1 = require("node:crypto");
const audit_log_service_1 = require("../../common/audit/audit-log.service");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const backup_config_1 = require("./backup-config");
const backup_drive_integration_service_1 = require("./backup-drive-integration.service");
const backup_drive_service_1 = require("./backup-drive.service");
let BackupDriveAuthService = class BackupDriveAuthService {
    backupConfig;
    integration;
    drive;
    audit;
    prisma;
    constructor(backupConfig, integration, drive, audit, prisma) {
        this.backupConfig = backupConfig;
        this.integration = integration;
        this.drive = drive;
        this.audit = audit;
        this.prisma = prisma;
    }
    buildAuthUrl(user) {
        this.assertConfigured();
        const state = this.signState({
            userId: user.id,
            nonce: (0, node_crypto_1.randomBytes)(16).toString('base64url'),
            exp: Math.floor(Date.now() / 1000) + 600,
        });
        const params = new URLSearchParams({
            client_id: this.backupConfig.gdriveClientId,
            redirect_uri: this.backupConfig.gdriveRedirectUri,
            response_type: 'code',
            access_type: 'offline',
            prompt: 'consent',
            scope: 'https://www.googleapis.com/auth/drive.file',
            state,
        });
        return {
            state,
            url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
        };
    }
    async handleCallback(code, state) {
        this.assertConfigured();
        if (!code?.trim())
            throw new common_1.BadRequestException('Missing OAuth authorization code.');
        if (!state?.trim())
            throw new common_1.BadRequestException('Missing OAuth state.');
        const payload = this.verifyState(state);
        const tokens = await this.drive.exchangeCodeForTokens(code.trim());
        if (!tokens.refresh_token) {
            throw new common_1.BadRequestException('Google did not return a refresh token. Re-authorize with prompt=consent.');
        }
        const folderId = await this.drive.ensureRootFolder(tokens.refresh_token);
        await this.integration.saveConnection({
            refreshToken: tokens.refresh_token,
            folderId,
            connectedByUserId: payload.userId,
        });
        const actor = await this.prisma.user.findUnique({
            where: { id: payload.userId },
            select: { id: true, email: true, role: true, companyId: true, fullName: true },
        });
        if (actor) {
            await this.audit.log({
                actorId: actor.id,
                actorEmail: actor.email,
                actorName: actor.fullName,
                actorRole: actor.role,
                companyId: actor.companyId,
                action: 'backup.drive.connected',
                resourceType: 'backup_drive_integration',
                resourceId: folderId,
                newState: {
                    message: `${actor.email} connected Google Drive for backup storage`,
                    folderId,
                },
            });
        }
        return {
            connected: true,
            folderId,
            connectedByUserId: payload.userId,
        };
    }
    async disconnect(user) {
        const hadConnection = await this.integration.disconnect();
        if (hadConnection) {
            await this.audit.log(this.audit.fromPrincipal(user, {
                action: 'backup.drive.disconnected',
                resourceType: 'backup_drive_integration',
                resourceId: 'google_drive',
                newState: {
                    message: `${user.email ?? user.id} disconnected Google Drive`,
                },
            }));
        }
        return { disconnected: hadConnection };
    }
    assertConfigured() {
        if (!this.backupConfig.gdriveConfigured()) {
            throw new common_1.ServiceUnavailableException('Google Drive integration is not configured (BACKUP_GDRIVE_ENABLED and OAuth env vars).');
        }
    }
    signState(payload) {
        const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
        const sig = (0, node_crypto_1.createHmac)('sha256', this.backupConfig.signingSecret)
            .update(body)
            .digest('base64url');
        return `${body}.${sig}`;
    }
    verifyState(state) {
        const parts = state.split('.');
        if (parts.length !== 2)
            throw new common_1.BadRequestException('Invalid OAuth state.');
        const [body, sig] = parts;
        const expected = (0, node_crypto_1.createHmac)('sha256', this.backupConfig.signingSecret)
            .update(body)
            .digest('base64url');
        const a = Buffer.from(sig);
        const b = Buffer.from(expected);
        if (a.length !== b.length || !(0, node_crypto_1.timingSafeEqual)(a, b)) {
            throw new common_1.BadRequestException('Invalid OAuth state signature.');
        }
        const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
        if (payload.exp < Math.floor(Date.now() / 1000)) {
            throw new common_1.BadRequestException('OAuth state has expired.');
        }
        return payload;
    }
};
exports.BackupDriveAuthService = BackupDriveAuthService;
exports.BackupDriveAuthService = BackupDriveAuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [backup_config_1.BackupConfig,
        backup_drive_integration_service_1.BackupDriveIntegrationService,
        backup_drive_service_1.BackupDriveService,
        audit_log_service_1.AuditLogService,
        prisma_service_1.PrismaService])
], BackupDriveAuthService);
//# sourceMappingURL=backup-drive-auth.service.js.map