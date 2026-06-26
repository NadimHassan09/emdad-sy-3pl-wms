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
var BackupDriveService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BackupDriveService = void 0;
const common_1 = require("@nestjs/common");
const node_fs_1 = require("node:fs");
const promises_1 = require("node:fs/promises");
const promises_2 = require("node:stream/promises");
const googleapis_1 = require("googleapis");
const backup_config_1 = require("./backup-config");
let BackupDriveService = BackupDriveService_1 = class BackupDriveService {
    backupConfig;
    logger = new common_1.Logger(BackupDriveService_1.name);
    constructor(backupConfig) {
        this.backupConfig = backupConfig;
    }
    createOAuthClient(refreshToken) {
        this.assertConfigured();
        const client = new googleapis_1.google.auth.OAuth2(this.backupConfig.gdriveClientId, this.backupConfig.gdriveClientSecret, this.backupConfig.gdriveRedirectUri);
        if (refreshToken) {
            client.setCredentials({ refresh_token: refreshToken });
        }
        return client;
    }
    async exchangeCodeForTokens(code) {
        const client = this.createOAuthClient();
        const { tokens } = await client.getToken(code);
        return tokens;
    }
    async ensureRootFolder(refreshToken) {
        const drive = googleapis_1.google.drive({ version: 'v3', auth: this.createOAuthClient(refreshToken) });
        const folderName = this.backupConfig.gdriveRootFolderName;
        const existing = await drive.files.list({
            q: `mimeType='application/vnd.google-apps.folder' and name='${folderName.replace(/'/g, "\\'")}' and trashed=false`,
            fields: 'files(id,name)',
            pageSize: 1,
            supportsAllDrives: true,
            includeItemsFromAllDrives: true,
        });
        const found = existing.data.files?.[0]?.id;
        if (found)
            return found;
        const created = await drive.files.create({
            requestBody: {
                name: folderName,
                mimeType: 'application/vnd.google-apps.folder',
            },
            fields: 'id',
            supportsAllDrives: true,
        });
        if (!created.data.id)
            throw new Error('Failed to create Google Drive root folder.');
        return created.data.id;
    }
    async testConnection(refreshToken, folderId) {
        const drive = googleapis_1.google.drive({ version: 'v3', auth: this.createOAuthClient(refreshToken) });
        const folder = await drive.files.get({
            fileId: folderId,
            fields: 'id,name,mimeType,trashed',
            supportsAllDrives: true,
        });
        if (folder.data.trashed) {
            throw new common_1.BadRequestException('Configured Google Drive folder is in trash.');
        }
        if (folder.data.mimeType !== 'application/vnd.google-apps.folder') {
            throw new common_1.BadRequestException('Configured Google Drive resource is not a folder.');
        }
        await drive.files.list({
            q: `'${folderId}' in parents and trashed=false`,
            pageSize: 1,
            fields: 'files(id)',
            supportsAllDrives: true,
            includeItemsFromAllDrives: true,
        });
        return {
            ok: true,
            folderName: folder.data.name ?? null,
            folderId,
        };
    }
    async uploadEncryptedDump(input) {
        const drive = googleapis_1.google.drive({ version: 'v3', auth: this.createOAuthClient(input.refreshToken) });
        const monthFolder = new Date().toISOString().slice(0, 7);
        const envFolderId = await this.ensureChildFolder(drive, input.rootFolderId, input.environmentId);
        const periodFolderId = await this.ensureChildFolder(drive, envFolderId, monthFolder);
        const created = await drive.files.create({
            requestBody: {
                name: input.encFilename,
                parents: [periodFolderId],
            },
            media: {
                mimeType: 'application/octet-stream',
                body: (0, node_fs_1.createReadStream)(input.encFilePath),
            },
            fields: 'id',
            supportsAllDrives: true,
        });
        if (!created.data.id)
            throw new Error('Google Drive upload returned no file id.');
        this.logger.log(`Uploaded encrypted backup ${input.jobId} to Drive file ${created.data.id}`);
        return created.data.id;
    }
    async ensureChildFolder(drive, parentId, name) {
        const escaped = name.replace(/'/g, "\\'");
        const existing = await drive.files.list({
            q: `mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and name='${escaped}' and trashed=false`,
            fields: 'files(id)',
            pageSize: 1,
            supportsAllDrives: true,
            includeItemsFromAllDrives: true,
        });
        const found = existing.data.files?.[0]?.id;
        if (found)
            return found;
        const created = await drive.files.create({
            requestBody: {
                name,
                mimeType: 'application/vnd.google-apps.folder',
                parents: [parentId],
            },
            fields: 'id',
            supportsAllDrives: true,
        });
        if (!created.data.id)
            throw new Error(`Failed to create Drive folder "${name}".`);
        return created.data.id;
    }
    async downloadEncryptedDump(input) {
        const drive = googleapis_1.google.drive({ version: 'v3', auth: this.createOAuthClient(input.refreshToken) });
        const dest = (0, node_fs_1.createWriteStream)(input.targetPath, { mode: 0o600 });
        const res = await drive.files.get({
            fileId: input.fileId,
            alt: 'media',
            supportsAllDrives: true,
        }, { responseType: 'stream' });
        await (0, promises_2.pipeline)(res.data, dest);
        const fileStat = await (0, promises_1.stat)(input.targetPath);
        this.logger.log(`Downloaded encrypted backup from Drive file ${input.fileId}`);
        return fileStat.size;
    }
    async deleteFile(refreshToken, fileId) {
        const drive = googleapis_1.google.drive({ version: 'v3', auth: this.createOAuthClient(refreshToken) });
        await drive.files.delete({
            fileId,
            supportsAllDrives: true,
        });
        this.logger.log(`Deleted Google Drive file ${fileId}`);
    }
    assertConfigured() {
        if (!this.backupConfig.gdriveConfigured()) {
            throw new common_1.ServiceUnavailableException('Google Drive integration is not configured (BACKUP_GDRIVE_ENABLED and OAuth env vars).');
        }
    }
};
exports.BackupDriveService = BackupDriveService;
exports.BackupDriveService = BackupDriveService = BackupDriveService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [backup_config_1.BackupConfig])
], BackupDriveService);
//# sourceMappingURL=backup-drive.service.js.map