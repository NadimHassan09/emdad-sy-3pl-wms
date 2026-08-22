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
exports.DocumentStorageService = void 0;
const node_crypto_1 = require("node:crypto");
const node_fs_1 = require("node:fs");
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const client_1 = require("@prisma/client");
let DocumentStorageService = class DocumentStorageService {
    baseDir;
    subdir = {
        [client_1.DocumentType.grn]: 'grn',
        [client_1.DocumentType.delivery_note]: 'delivery-notes',
        [client_1.DocumentType.final_contract]: 'final-contracts',
    };
    constructor(config) {
        const configured = (config.get('DOCUMENT_STORAGE_DIR') ?? '').trim();
        this.baseDir = configured
            ? (0, node_path_1.isAbsolute)(configured)
                ? configured
                : (0, node_path_1.join)(process.cwd(), configured)
            : (0, node_path_1.join)(process.cwd(), 'storage', 'documents');
    }
    async write(type, fileName, buffer) {
        const dir = (0, node_path_1.join)(this.baseDir, this.subdir[type]);
        if (!(0, node_fs_1.existsSync)(dir)) {
            await (0, promises_1.mkdir)(dir, { recursive: true });
        }
        const filePath = (0, node_path_1.join)(dir, fileName);
        await (0, promises_1.writeFile)(filePath, buffer, { flag: 'wx' }).catch(async (err) => {
            if (err.code !== 'EEXIST')
                throw err;
        });
        const hash = (0, node_crypto_1.createHash)('sha256').update(buffer).digest('hex');
        return { fileName, filePath, hash, fileSize: buffer.byteLength };
    }
    async replace(type, fileName, buffer) {
        const dir = (0, node_path_1.join)(this.baseDir, this.subdir[type]);
        if (!(0, node_fs_1.existsSync)(dir)) {
            await (0, promises_1.mkdir)(dir, { recursive: true });
        }
        const filePath = (0, node_path_1.join)(dir, fileName);
        await (0, promises_1.writeFile)(filePath, buffer);
        const hash = (0, node_crypto_1.createHash)('sha256').update(buffer).digest('hex');
        return { fileName, filePath, hash, fileSize: buffer.byteLength };
    }
};
exports.DocumentStorageService = DocumentStorageService;
exports.DocumentStorageService = DocumentStorageService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], DocumentStorageService);
//# sourceMappingURL=document-storage.service.js.map