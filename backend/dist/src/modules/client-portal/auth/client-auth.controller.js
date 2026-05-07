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
const public_decorator_1 = require("../../../common/auth/public.decorator");
const client_user_decorator_1 = require("./client-user.decorator");
const client_auth_service_1 = require("./client-auth.service");
const client_login_dto_1 = require("./dto/client-login.dto");
const jwt_client_auth_guard_1 = require("./jwt-client-auth.guard");
let ClientAuthController = class ClientAuthController {
    auth;
    constructor(auth) {
        this.auth = auth;
    }
    login(dto, res) {
        return this.auth.login(dto, res);
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
};
exports.ClientAuthController = ClientAuthController;
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Post)('login'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [client_login_dto_1.ClientLoginDto, Object]),
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
exports.ClientAuthController = ClientAuthController = __decorate([
    (0, common_1.Controller)('client/auth'),
    __metadata("design:paramtypes", [client_auth_service_1.ClientAuthService])
], ClientAuthController);
//# sourceMappingURL=client-auth.controller.js.map