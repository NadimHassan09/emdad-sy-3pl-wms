"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImageProcessingService = void 0;
const common_1 = require("@nestjs/common");
const sharp_1 = __importDefault(require("sharp"));
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
let ImageProcessingService = class ImageProcessingService {
    async compress(buffer, mimeType, kind) {
        if (!ALLOWED_MIME.has(mimeType)) {
            throw new common_1.BadRequestException('Only JPEG, PNG, WebP, or GIF images are allowed.');
        }
        const maxEdge = kind === 'avatar' ? 512 : 1200;
        const quality = kind === 'avatar' ? 82 : 78;
        try {
            return await (0, sharp_1.default)(buffer, { failOn: 'truncated' })
                .rotate()
                .resize({
                width: maxEdge,
                height: maxEdge,
                fit: 'inside',
                withoutEnlargement: true,
            })
                .webp({ quality, effort: 4 })
                .toBuffer();
        }
        catch {
            throw new common_1.BadRequestException('Could not process this image. Please upload a valid photo.');
        }
    }
};
exports.ImageProcessingService = ImageProcessingService;
exports.ImageProcessingService = ImageProcessingService = __decorate([
    (0, common_1.Injectable)()
], ImageProcessingService);
//# sourceMappingURL=image-processing.service.js.map