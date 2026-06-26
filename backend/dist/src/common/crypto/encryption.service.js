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
exports.EncryptionService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const node_crypto_1 = require("node:crypto");
const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const PREFIX = 'v1';
let EncryptionService = class EncryptionService {
    config;
    constructor(config) {
        this.config = config;
    }
    encrypt(plaintext) {
        const key = this.resolveKey();
        const iv = (0, node_crypto_1.randomBytes)(IV_BYTES);
        const cipher = (0, node_crypto_1.createCipheriv)(ALGORITHM, key, iv);
        const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
        const authTag = cipher.getAuthTag();
        return [
            PREFIX,
            iv.toString('base64url'),
            authTag.toString('base64url'),
            encrypted.toString('base64url'),
        ].join(':');
    }
    decrypt(ciphertext) {
        const key = this.resolveKey();
        const parts = ciphertext.split(':');
        if (parts.length !== 4 || parts[0] !== PREFIX) {
            throw new Error('Unsupported ciphertext format.');
        }
        const [, ivB64, tagB64, dataB64] = parts;
        const iv = Buffer.from(ivB64, 'base64url');
        const authTag = Buffer.from(tagB64, 'base64url');
        const encrypted = Buffer.from(dataB64, 'base64url');
        const decipher = (0, node_crypto_1.createDecipheriv)(ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);
        return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
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
exports.EncryptionService = EncryptionService;
exports.EncryptionService = EncryptionService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], EncryptionService);
//# sourceMappingURL=encryption.service.js.map