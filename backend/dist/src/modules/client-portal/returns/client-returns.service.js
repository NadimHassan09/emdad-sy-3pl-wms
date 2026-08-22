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
exports.ClientReturnsService = void 0;
const common_1 = require("@nestjs/common");
const client_auth_principal_1 = require("../../../common/auth/client-auth-principal");
const returns_service_1 = require("../../returns/returns.service");
let ClientReturnsService = class ClientReturnsService {
    returns;
    constructor(returns) {
        this.returns = returns;
    }
    list(client, query) {
        return this.returns.list((0, client_auth_principal_1.clientAuthPrincipal)(client), {
            ...query,
            companyId: client.companyId,
        });
    }
    findOne(client, id) {
        return this.returns.findById(id, (0, client_auth_principal_1.clientAuthPrincipal)(client));
    }
    getOutboundQuota(client, outboundId) {
        return this.returns.getOutboundReturnQuota((0, client_auth_principal_1.clientAuthPrincipal)(client), outboundId);
    }
    create(client, dto) {
        return this.returns.create((0, client_auth_principal_1.clientAuthPrincipal)(client), {
            ...dto,
            companyId: client.companyId,
        });
    }
};
exports.ClientReturnsService = ClientReturnsService;
exports.ClientReturnsService = ClientReturnsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [returns_service_1.ReturnsService])
], ClientReturnsService);
//# sourceMappingURL=client-returns.service.js.map