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
exports.ClientAuthController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const throttler_1 = require("@nestjs/throttler");
const multer_1 = require("multer");
const public_decorator_1 = require("../../../common/auth/public.decorator");
const client_user_decorator_1 = require("./client-user.decorator");
const client_auth_service_1 = require("./client-auth.service");
const client_login_dto_1 = require("./dto/client-login.dto");
const jwt_client_auth_guard_1 = require("./jwt-client-auth.guard");
const MAX_AVATAR_BYTES = 8 * 1024 * 1024;
function assertUploadedImage(file) {
    if (!file?.buffer?.length) {
        throw new common_1.BadRequestException('Please choose an image file to upload.');
    }
    if (!file.mimetype?.startsWith('image/')) {
        throw new common_1.BadRequestException('Only image files are allowed.');
    }
    return file;
}
let ClientAuthController = class ClientAuthController {
    auth;
    constructor(auth) {
        this.auth = auth;
    }
    login(dto, req, res) {
        return this.auth.login(dto, req, res);
    }
    logout(res) {
        res.clearCookie('client_access_token', {
            path: '/',
            httpOnly: true,
            sameSite: 'lax',
        });
    }
    me(user) {
        return this.auth.getMe(user);
    }
    uploadAvatar(user, file) {
        return this.auth.uploadAvatar(user, assertUploadedImage(file));
    }
    deleteAvatar(user) {
        return this.auth.deleteAvatar(user);
    }
};
exports.ClientAuthController = ClientAuthController;
__decorate([
    (0, public_decorator_1.Public)(),
    (0, throttler_1.SkipThrottle)(),
    (0, common_1.Post)('login'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [client_login_dto_1.ClientLoginDto, Object, Object]),
    __metadata("design:returntype", void 0)
], ClientAuthController.prototype, "login", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Post)('logout'),
    (0, common_1.HttpCode)(204),
    __param(0, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ClientAuthController.prototype, "logout", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)('me'),
    (0, common_1.UseGuards)(jwt_client_auth_guard_1.JwtClientAuthGuard),
    __param(0, (0, client_user_decorator_1.ClientUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ClientAuthController.prototype, "me", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Post)('avatar'),
    (0, common_1.UseGuards)(jwt_client_auth_guard_1.JwtClientAuthGuard),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', {
        storage: (0, multer_1.memoryStorage)(),
        limits: { fileSize: MAX_AVATAR_BYTES },
    })),
    __param(0, (0, client_user_decorator_1.ClientUser)()),
    __param(1, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], ClientAuthController.prototype, "uploadAvatar", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Delete)('avatar'),
    (0, common_1.HttpCode)(204),
    (0, common_1.UseGuards)(jwt_client_auth_guard_1.JwtClientAuthGuard),
    __param(0, (0, client_user_decorator_1.ClientUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ClientAuthController.prototype, "deleteAvatar", null);
exports.ClientAuthController = ClientAuthController = __decorate([
    (0, common_1.Controller)('client/auth'),
    __metadata("design:paramtypes", [client_auth_service_1.ClientAuthService])
], ClientAuthController);
//# sourceMappingURL=client-auth.controller.js.map