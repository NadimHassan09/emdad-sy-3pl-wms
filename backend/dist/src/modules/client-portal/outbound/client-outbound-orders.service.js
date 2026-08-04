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
exports.ClientOutboundOrdersService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const client_auth_principal_1 = require("../../../common/auth/client-auth-principal");
const outbound_service_1 = require("../../outbound/outbound.service");
const client_list_outbound_query_dto_1 = require("./dto/client-list-outbound-query.dto");
function toProductImageUrl(imagePath) {
    if (!imagePath?.trim())
        return null;
    return `/media/${imagePath.replace(/^\/+/, '')}`;
}
let ClientOutboundOrdersService = class ClientOutboundOrdersService {
    outbound;
    constructor(outbound) {
        this.outbound = outbound;
    }
    async findOne(client, id) {
        const order = await this.outbound.findById(id, (0, client_auth_principal_1.clientAuthPrincipal)(client));
        return {
            ...order,
            lines: order.lines.map((line) => ({
                ...line,
                product: {
                    ...line.product,
                    imageUrl: toProductImageUrl(line.product.imagePath),
                },
            })),
        };
    }
    async list(client, query) {
        const principal = (0, client_auth_principal_1.clientAuthPrincipal)(client);
        const base = {
            limit: query.limit,
            offset: query.offset,
            orderSearch: query.orderSearch,
            companyId: client.companyId,
        };
        if (query.status === 'in_progress') {
            base.statusIn = client_list_outbound_query_dto_1.CLIENT_OUTBOUND_IN_PROGRESS_STATUSES;
        }
        else if (query.status === 'shipped') {
            base.statusIn = [client_1.OutboundOrderStatus.shipped, client_1.OutboundOrderStatus.delivered];
        }
        else if (query.status) {
            base.status = query.status;
        }
        return this.outbound.list(principal, base);
    }
    async create(client, dto) {
        return this.outbound.create((0, client_auth_principal_1.clientAuthPrincipal)(client), { ...dto, executionMode: 'admin', executionPlan: undefined }, { pendingClientApproval: true });
    }
};
exports.ClientOutboundOrdersService = ClientOutboundOrdersService;
exports.ClientOutboundOrdersService = ClientOutboundOrdersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [outbound_service_1.OutboundService])
], ClientOutboundOrdersService);
//# sourceMappingURL=client-outbound-orders.service.js.map