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
exports.ClientInboundOrdersService = void 0;
const common_1 = require("@nestjs/common");
const client_auth_principal_1 = require("../../../common/auth/client-auth-principal");
const inbound_service_1 = require("../../inbound/inbound.service");
let ClientInboundOrdersService = class ClientInboundOrdersService {
    inbound;
    constructor(inbound) {
        this.inbound = inbound;
    }
    async findOne(client, id) {
        return this.inbound.findById(id, (0, client_auth_principal_1.clientAuthPrincipal)(client));
    }
    async list(client, query) {
        return this.inbound.list((0, client_auth_principal_1.clientAuthPrincipal)(client), {
            ...query,
            companyId: client.companyId,
        });
    }
    async create(client, dto) {
        return this.inbound.create((0, client_auth_principal_1.clientAuthPrincipal)(client), dto, {
            pendingClientApproval: true,
        });
    }
};
exports.ClientInboundOrdersService = ClientInboundOrdersService;
exports.ClientInboundOrdersService = ClientInboundOrdersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [inbound_service_1.InboundService])
], ClientInboundOrdersService);
//# sourceMappingURL=client-inbound-orders.service.js.map