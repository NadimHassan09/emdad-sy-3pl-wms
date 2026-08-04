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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClientMediaController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const multer_1 = require("multer");
const node_fs_1 = require("node:fs");
const client_1 = require("@prisma/client");
const public_decorator_1 = require("../../../common/auth/public.decorator");
const parse_uuid_loose_pipe_1 = require("../../../common/pipes/parse-uuid-loose.pipe");
const prisma_service_1 = require("../../../common/prisma/prisma.service");
const image_processing_service_1 = require("../../media/image-processing.service");
const media_storage_service_1 = require("../../media/media-storage.service");
const client_user_decorator_1 = require("../auth/client-user.decorator");
const jwt_client_auth_guard_1 = require("../auth/jwt-client-auth.guard");
const client_products_service_1 = require("../products/client-products.service");
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
function assertUploadedImage(file) {
    if (!file?.buffer?.length) {
        throw new common_1.BadRequestException('Please choose an image file to upload.');
    }
    if (!file.mimetype?.startsWith('image/')) {
        throw new common_1.BadRequestException('Only image files are allowed.');
    }
    return file;
}
let ClientMediaController = class ClientMediaController {
    prisma;
    images;
    storage;
    products;
    constructor(prisma, images, storage, products) {
        this.prisma = prisma;
        this.images = images;
        this.storage = storage;
        this.products = products;
    }
    async uploadProductImage(client, id, file) {
        if (client.role === client_1.UserRole.client_staff) {
            throw new common_1.ForbiddenException('Only client administrators can upload product photos.');
        }
        const product = await this.products.findById(client, id);
        const uploaded = assertUploadedImage(file);
        const compressed = await this.images.compress(uploaded.buffer, uploaded.mimetype, 'product');
        const saved = await this.storage.write('products', client.companyId, compressed);
        await this.storage.remove(product.imagePath ?? null);
        await this.prisma.product.update({
            where: { id },
            data: { imagePath: saved.relativePath },
        });
        return {
            id,
            imageUrl: `/media/products/${id}`,
            byteSize: saved.byteSize,
        };
    }
    async deleteProductImage(client, id) {
        if (client.role === client_1.UserRole.client_staff) {
            throw new common_1.ForbiddenException('Only client administrators can remove product photos.');
        }
        const product = await this.products.findById(client, id);
        await this.storage.remove(product.imagePath ?? null);
        await this.prisma.product.update({
            where: { id },
            data: { imagePath: null },
        });
    }
    async getProductImage(client, id, res) {
        const product = await this.prisma.product.findFirst({
            where: { id, companyId: client.companyId },
            select: { imagePath: true },
        });
        if (!product?.imagePath)
            throw new common_1.NotFoundException('Product image not found.');
        const absolute = this.storage.absolutePath(product.imagePath);
        if (!(0, node_fs_1.existsSync)(absolute))
            throw new common_1.NotFoundException('Product image not found.');
        res.setHeader('Content-Type', 'image/webp');
        res.setHeader('Cache-Control', 'private, max-age=3600');
        (0, node_fs_1.createReadStream)(absolute).pipe(res);
    }
};
exports.ClientMediaController = ClientMediaController;
__decorate([
    (0, common_1.Post)('products/:id/image'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', {
        storage: (0, multer_1.memoryStorage)(),
        limits: { fileSize: MAX_UPLOAD_BYTES },
    })),
    __param(0, (0, client_user_decorator_1.ClientUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __param(2, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], ClientMediaController.prototype, "uploadProductImage", null);
__decorate([
    (0, common_1.Delete)('products/:id/image'),
    (0, common_1.HttpCode)(204),
    __param(0, (0, client_user_decorator_1.ClientUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ClientMediaController.prototype, "deleteProductImage", null);
__decorate([
    (0, common_1.Get)('media/products/:id'),
    __param(0, (0, client_user_decorator_1.ClientUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], ClientMediaController.prototype, "getProductImage", null);
exports.ClientMediaController = ClientMediaController = __decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.UseGuards)(jwt_client_auth_guard_1.JwtClientAuthGuard),
    (0, common_1.Controller)('client'),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        image_processing_service_1.ImageProcessingService,
        media_storage_service_1.MediaStorageService,
        client_products_service_1.ClientProductsService])
], ClientMediaController);
//# sourceMappingURL=client-media.controller.js.map