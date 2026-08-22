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
exports.OmsSalesChannelService = void 0;
const common_1 = require("@nestjs/common");
const company_read_scope_1 = require("../../../common/auth/company-read-scope");
const company_access_service_1 = require("../../../common/company-access/company-access.service");
const prisma_service_1 = require("../../../common/prisma/prisma.service");
const tenant_rls_1 = require("../../../common/prisma/tenant-rls");
const oms_channel_handlers_registry_1 = require("./oms-channel-handlers.registry");
const oms_channel_util_1 = require("./oms-channel.util");
let OmsSalesChannelService = class OmsSalesChannelService {
    prisma;
    companyAccess;
    constructor(prisma, companyAccess) {
        this.prisma = prisma;
        this.companyAccess = companyAccess;
    }
    async list(user, companyId) {
        const cid = (0, company_read_scope_1.readCompanyIdFilterRequired)(this.companyAccess, user, companyId);
        return (0, tenant_rls_1.withTenantRls)(this.prisma, user, (tx) => tx.omsSalesChannel.findMany({
            where: { companyId: cid },
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                companyId: true,
                channelType: true,
                name: true,
                externalStoreId: true,
                isActive: true,
                config: true,
                lastSyncAt: true,
                createdAt: true,
                updatedAt: true,
            },
        }));
    }
    async create(user, dto) {
        const companyId = (0, company_read_scope_1.readCompanyIdFilterRequired)(this.companyAccess, user, dto.companyId);
        if (!companyId) {
            throw new common_1.BadRequestException('companyId is required.');
        }
        const webhookSecret = (0, oms_channel_util_1.generateWebhookSecret)();
        const row = await (0, tenant_rls_1.withTenantRls)(this.prisma, user, (tx) => tx.omsSalesChannel.create({
            data: {
                companyId,
                channelType: dto.channelType,
                name: dto.name.trim(),
                externalStoreId: dto.externalStoreId?.trim() || null,
                webhookSecretHash: (0, oms_channel_util_1.hashWebhookSecret)(webhookSecret),
                ...(dto.config !== undefined
                    ? { config: dto.config }
                    : {}),
            },
        }));
        return {
            channel: {
                id: row.id,
                companyId: row.companyId,
                channelType: row.channelType,
                name: row.name,
                externalStoreId: row.externalStoreId,
                isActive: row.isActive,
                webhookUrl: `/api/oms/webhooks/inbound/${row.id}`,
            },
            webhookSecret,
        };
    }
    async processInboundWebhook(channelId, secret, input) {
        const channel = await this.prisma.omsSalesChannel.findUnique({
            where: { id: channelId },
        });
        if (!channel || !channel.isActive) {
            throw new common_1.NotFoundException('Sales channel not found.');
        }
        if (!secret || !(0, oms_channel_util_1.verifyWebhookSecret)(secret, channel.webhookSecretHash)) {
            throw new common_1.UnauthorizedException('Invalid webhook secret.');
        }
        const handler = (0, oms_channel_handlers_registry_1.resolveChannelHandler)(channel.channelType);
        const result = await handler({
            companyId: channel.companyId,
            channelType: channel.channelType,
            channelId: channel.id,
            payload: input.payload,
        });
        const event = await this.prisma.omsIntegrationEvent.create({
            data: {
                companyId: channel.companyId,
                salesChannelId: channel.id,
                eventType: input.eventType ?? 'order.inbound',
                externalId: input.externalId ?? result.externalId,
                payload: input.payload,
                status: result.accepted ? 'accepted' : 'rejected',
                errorMessage: result.accepted ? null : result.message,
            },
        });
        if (!result.accepted) {
            throw new common_1.BadRequestException(result.message ?? 'Webhook rejected by channel handler.');
        }
        return {
            integrationEventId: event.id,
            status: event.status,
            message: result.message,
        };
    }
};
exports.OmsSalesChannelService = OmsSalesChannelService;
exports.OmsSalesChannelService = OmsSalesChannelService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        company_access_service_1.CompanyAccessService])
], OmsSalesChannelService);
//# sourceMappingURL=oms-sales-channel.service.js.map