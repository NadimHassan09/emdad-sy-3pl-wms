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
exports.MockAuthMiddleware = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (value) => typeof value === 'string' && UUID_RE.test(value);
let MockAuthMiddleware = class MockAuthMiddleware {
    config;
    constructor(config) {
        this.config = config;
    }
    use(req, _res, next) {
        const headerUserId = req.header('X-User-Id');
        const headerCompanyId = req.header('X-Company-Id');
        const userId = isUuid(headerUserId) ? headerUserId : this.config.get('MOCK_USER_ID');
        const companyIdRaw = isUuid(headerCompanyId)
            ? headerCompanyId
            : this.config.get('MOCK_COMPANY_ID');
        if (!userId || !isUuid(userId)) {
            return next();
        }
        const principal = {
            id: userId,
            companyId: isUuid(companyIdRaw) ? companyIdRaw : null,
            role: 'wh_manager',
        };
        req.user = principal;
        next();
    }
};
exports.MockAuthMiddleware = MockAuthMiddleware;
exports.MockAuthMiddleware = MockAuthMiddleware = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], MockAuthMiddleware);
//# sourceMappingURL=mock-auth.middleware.js.map