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
exports.MediaStorageService = void 0;
const node_crypto_1 = require("node:crypto");
const node_fs_1 = require("node:fs");
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
let MediaStorageService = class MediaStorageService {
    baseDir;
    constructor(config) {
        const configured = (config.get('MEDIA_STORAGE_DIR') ?? '').trim();
        this.baseDir = configured
            ? (0, node_path_1.isAbsolute)(configured)
                ? configured
                : (0, node_path_1.join)(process.cwd(), configured)
            : (0, node_path_1.join)(process.cwd(), 'storage', 'media');
    }
    absolutePath(relativePath) {
        const cleaned = relativePath.replace(/^[/\\]+/, '');
        const full = (0, node_path_1.normalize)((0, node_path_1.join)(this.baseDir, cleaned));
        const base = (0, node_path_1.normalize)(this.baseDir);
        if (full !== base && !full.startsWith(base + node_path_1.sep)) {
            throw new common_1.NotFoundException('Media file not found.');
        }
        return full;
    }
    async write(kind, companyId, buffer) {
        const dir = (0, node_path_1.join)(this.baseDir, kind, companyId);
        if (!(0, node_fs_1.existsSync)(dir)) {
            await (0, promises_1.mkdir)(dir, { recursive: true });
        }
        const fileName = `${(0, node_crypto_1.randomUUID)()}.webp`;
        const absolute = (0, node_path_1.join)(dir, fileName);
        await (0, promises_1.writeFile)(absolute, buffer);
        const relativePath = (0, node_path_1.join)(kind, companyId, fileName).split(node_path_1.sep).join('/');
        return {
            relativePath,
            byteSize: buffer.byteLength,
            hash: (0, node_crypto_1.createHash)('sha256').update(buffer).digest('hex'),
        };
    }
    async remove(relativePath) {
        if (!relativePath?.trim())
            return;
        const absolute = this.absolutePath(relativePath.trim());
        try {
            await (0, promises_1.unlink)(absolute);
        }
        catch (err) {
            const code = err.code;
            if (code !== 'ENOENT')
                throw err;
        }
    }
};
exports.MediaStorageService = MediaStorageService;
exports.MediaStorageService = MediaStorageService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], MediaStorageService);
//# sourceMappingURL=media-storage.service.js.map