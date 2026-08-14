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
exports.AuthController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const throttler_1 = require("@nestjs/throttler");
const class_validator_1 = require("class-validator");
const multer_1 = require("multer");
const current_user_decorator_1 = require("../../common/auth/current-user.decorator");
const public_decorator_1 = require("../../common/auth/public.decorator");
const auth_service_1 = require("./auth.service");
const login_dto_1 = require("./dto/login.dto");
const google_oauth_service_1 = require("./google-oauth.service");
class LogoutDto {
    soft;
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], LogoutDto.prototype, "soft", void 0);
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
let AuthController = class AuthController {
    auth;
    googleOAuth;
    constructor(auth, googleOAuth) {
        this.auth = auth;
        this.googleOAuth = googleOAuth;
    }
    login(dto, req, res) {
        return this.auth.login(dto, req, res);
    }
    refresh(req, res) {
        return this.auth.refresh(req, res);
    }
    logout(dto, req, res) {
        return this.auth.logout(req, res, { soft: Boolean(dto?.soft) });
    }
    me(user) {
        return this.auth.getProfile(user);
    }
    googleStatus() {
        return this.googleOAuth.getStatus();
    }
    googleLogin(rememberMe, res) {
        const url = this.googleOAuth.buildLoginUrl({
            rememberMe: rememberMe === '1' || rememberMe === 'true',
        });
        return res.redirect(url);
    }
    googleLink(user, res) {
        const url = this.googleOAuth.buildLinkUrl(user);
        return res.redirect(url);
    }
    async googleCallback(code, state, error, req, res) {
        await this.googleOAuth.handleCallback({ code, state, error }, req, res);
    }
    unlinkGoogle(user) {
        return this.googleOAuth.unlink(user);
    }
    uploadAvatar(user, file) {
        return this.auth.uploadAvatar(user, assertUploadedImage(file));
    }
    deleteAvatar(user) {
        return this.auth.deleteAvatar(user);
    }
};
exports.AuthController = AuthController;
__decorate([
    (0, public_decorator_1.Public)(),
    (0, throttler_1.SkipThrottle)(),
    (0, common_1.Post)('login'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [login_dto_1.LoginDto, Object, Object]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "login", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, throttler_1.SkipThrottle)(),
    (0, common_1.Post)('refresh'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "refresh", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Post)('logout'),
    (0, common_1.HttpCode)(204),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [LogoutDto, Object, Object]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "logout", null);
__decorate([
    (0, common_1.Get)('me'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "me", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)('google/status'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "googleStatus", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, throttler_1.SkipThrottle)(),
    (0, common_1.Get)('google/login'),
    __param(0, (0, common_1.Query)('rememberMe')),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "googleLogin", null);
__decorate([
    (0, throttler_1.SkipThrottle)(),
    (0, common_1.Get)('google/link'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "googleLink", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, throttler_1.SkipThrottle)(),
    (0, common_1.Get)('google/callback'),
    __param(0, (0, common_1.Query)('code')),
    __param(1, (0, common_1.Query)('state')),
    __param(2, (0, common_1.Query)('error')),
    __param(3, (0, common_1.Req)()),
    __param(4, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "googleCallback", null);
__decorate([
    (0, common_1.Post)('google/unlink'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "unlinkGoogle", null);
__decorate([
    (0, common_1.Post)('avatar'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', {
        storage: (0, multer_1.memoryStorage)(),
        limits: { fileSize: MAX_AVATAR_BYTES },
    })),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "uploadAvatar", null);
__decorate([
    (0, common_1.Delete)('avatar'),
    (0, common_1.HttpCode)(204),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "deleteAvatar", null);
exports.AuthController = AuthController = __decorate([
    (0, common_1.Controller)('auth'),
    __metadata("design:paramtypes", [auth_service_1.AuthService,
        google_oauth_service_1.GoogleOAuthService])
], AuthController);
//# sourceMappingURL=auth.controller.js.map