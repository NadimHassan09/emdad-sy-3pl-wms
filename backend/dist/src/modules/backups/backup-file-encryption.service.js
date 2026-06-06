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
exports.BackupFileEncryptionService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const node_crypto_1 = require("node:crypto");
const promises_1 = require("node:fs/promises");
const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const MAGIC = Buffer.from('EMDADBK1');
let BackupFileEncryptionService = class BackupFileEncryptionService {
    config;
    constructor(config) {
        this.config = config;
    }
    async encryptDumpFile(sourcePath, targetPath) {
        const key = this.resolveKey();
        const iv = (0, node_crypto_1.randomBytes)(IV_BYTES);
        const plain = await (0, promises_1.readFile)(sourcePath);
        const cipher = (0, node_crypto_1.createCipheriv)(ALGORITHM, key, iv);
        const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
        const authTag = cipher.getAuthTag();
        const output = Buffer.concat([MAGIC, iv, encrypted, authTag]);
        await (0, promises_1.writeFile)(targetPath, output, { mode: 0o600 });
        return output.length;
    }
    resolveKey() {
        const raw = this.config.get('BACKUP_ENCRYPTION_KEY')?.trim();
        if (!raw) {
            throw new common_1.ServiceUnavailableException('BACKUP_ENCRYPTION_KEY is not configured (32-byte base64 key required).');
        }
        const key = Buffer.from(raw, 'base64');
        if (key.length !== 32) {
            throw new common_1.ServiceUnavailableException('BACKUP_ENCRYPTION_KEY must decode to exactly 32 bytes.');
        }
        return key;
    }
};
exports.BackupFileEncryptionService = BackupFileEncryptionService;
exports.BackupFileEncryptionService = BackupFileEncryptionService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], BackupFileEncryptionService);
//# sourceMappingURL=backup-file-encryption.service.js.map