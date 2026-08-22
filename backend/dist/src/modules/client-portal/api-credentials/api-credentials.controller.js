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
exports.ApiCredentialsController = void 0;
const common_1 = require("@nestjs/common");
const throttler_1 = require("@nestjs/throttler");
const public_decorator_1 = require("../../../common/auth/public.decorator");
const parse_uuid_loose_pipe_1 = require("../../../common/pipes/parse-uuid-loose.pipe");
const client_user_decorator_1 = require("../auth/client-user.decorator");
const jwt_client_auth_guard_1 = require("../auth/jwt-client-auth.guard");
const api_docs_service_1 = require("../external-api/api-docs.service");
const api_credentials_service_1 = require("./api-credentials.service");
const create_api_credential_dto_1 = require("./dto/create-api-credential.dto");
let ApiCredentialsController = class ApiCredentialsController {
    credentials;
    docs;
    constructor(credentials, docs) {
        this.credentials = credentials;
        this.docs = docs;
    }
    list(client) {
        return this.credentials.list(client);
    }
    create(client, dto) {
        return this.credentials.create(client, dto);
    }
    async downloadCanonicalDocs(client, scope, res) {
        if (client.role !== 'client_admin') {
            res.status(403).json({
                success: false,
                error: { code: 'FORBIDDEN', message: 'Only company administrators can download API documentation.' },
            });
            return;
        }
        const parsed = this.parseScope(scope);
        const pdf = await this.docs.render(parsed);
        res.setHeader('Content-Disposition', `attachment; filename="emdad-${parsed}-api-documentation.pdf"`);
        res.send(pdf);
    }
    regenerate(client, id) {
        return this.credentials.regenerate(client, id);
    }
    revoke(client, id) {
        return this.credentials.revoke(client, id);
    }
    setEnabled(client, id, body) {
        return this.credentials.setEnabled(client, id, body.enabled !== false);
    }
    async downloadDocsForKey(client, id, res) {
        const scope = await this.credentials.requireOwnedScope(client, id);
        const pdf = await this.docs.render(scope);
        res.setHeader('Content-Disposition', `attachment; filename="emdad-${scope}-api-documentation.pdf"`);
        res.send(pdf);
    }
    parseScope(raw) {
        const s = raw.trim().toLowerCase();
        if (s === 'oms' || s === 'inbound' || s === 'outbound')
            return s;
        throw new common_1.BadRequestException('Unknown API type. Use oms, inbound, or outbound.');
    }
};
exports.ApiCredentialsController = ApiCredentialsController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, client_user_decorator_1.ClientUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ApiCredentialsController.prototype, "list", null);
__decorate([
    (0, throttler_1.Throttle)({ default: { limit: 10, ttl: 60_000 } }),
    (0, common_1.Post)(),
    __param(0, (0, client_user_decorator_1.ClientUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_api_credential_dto_1.CreateApiCredentialDto]),
    __metadata("design:returntype", void 0)
], ApiCredentialsController.prototype, "create", null);
__decorate([
    (0, common_1.Get)('docs/:scope'),
    (0, common_1.Header)('Content-Type', 'application/pdf'),
    __param(0, (0, client_user_decorator_1.ClientUser)()),
    __param(1, (0, common_1.Param)('scope')),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], ApiCredentialsController.prototype, "downloadCanonicalDocs", null);
__decorate([
    (0, common_1.Post)(':id/regenerate'),
    __param(0, (0, client_user_decorator_1.ClientUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ApiCredentialsController.prototype, "regenerate", null);
__decorate([
    (0, common_1.Post)(':id/revoke'),
    __param(0, (0, client_user_decorator_1.ClientUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ApiCredentialsController.prototype, "revoke", null);
__decorate([
    (0, common_1.Patch)(':id/enabled'),
    __param(0, (0, client_user_decorator_1.ClientUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], ApiCredentialsController.prototype, "setEnabled", null);
__decorate([
    (0, common_1.Get)(':id/docs'),
    (0, common_1.Header)('Content-Type', 'application/pdf'),
    __param(0, (0, client_user_decorator_1.ClientUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], ApiCredentialsController.prototype, "downloadDocsForKey", null);
exports.ApiCredentialsController = ApiCredentialsController = __decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.UseGuards)(jwt_client_auth_guard_1.JwtClientAuthGuard),
    (0, common_1.Controller)('client/apis'),
    __metadata("design:paramtypes", [api_credentials_service_1.ApiCredentialsService,
        api_docs_service_1.ApiDocsService])
], ApiCredentialsController);
//# sourceMappingURL=api-credentials.controller.js.map