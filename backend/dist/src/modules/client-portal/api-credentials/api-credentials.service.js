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
exports.ApiCredentialsService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../../common/prisma/prisma.service");
const api_credential_util_1 = require("./api-credential.util");
function assertClientAdmin(client) {
    if (client.role !== client_1.UserRole.client_admin) {
        throw new common_1.ForbiddenException('Only company administrators can manage API credentials.');
    }
}
function statusOf(row) {
    if (row.revokedAt)
        return 'revoked';
    if (!row.isActive)
        return 'disabled';
    return 'active';
}
let ApiCredentialsService = class ApiCredentialsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    list(client) {
        assertClientAdmin(client);
        return this.prisma.apiCredential
            .findMany({
            where: { companyId: client.companyId },
            orderBy: { createdAt: 'desc' },
        })
            .then((rows) => rows.map((row) => this.toListItem(row)));
    }
    async create(client, dto) {
        assertClientAdmin(client);
        const apiKey = (0, api_credential_util_1.generateApiKey)();
        const apiSecret = (0, api_credential_util_1.generateApiSecret)();
        const row = await this.prisma.apiCredential.create({
            data: {
                companyId: client.companyId,
                name: dto.name.trim(),
                scope: dto.scope,
                apiKey,
                keyPrefix: (0, api_credential_util_1.apiKeyPrefix)(apiKey),
                secretHash: (0, api_credential_util_1.hashApiSecret)(apiSecret),
                createdByUserId: client.id,
            },
        });
        return {
            ...this.toListItem(row),
            apiKey,
            apiSecret,
            warning: api_credential_util_1.SECRET_ONCE_WARNING,
        };
    }
    async regenerate(client, id) {
        const row = await this.requireOwned(client, id);
        if (row.revokedAt) {
            throw new common_1.ForbiddenException('A revoked API key cannot be regenerated.');
        }
        const apiSecret = (0, api_credential_util_1.generateApiSecret)();
        const updated = await this.prisma.apiCredential.update({
            where: { id: row.id },
            data: { secretHash: (0, api_credential_util_1.hashApiSecret)(apiSecret), updatedAt: new Date() },
        });
        return {
            ...this.toListItem(updated),
            apiKey: updated.apiKey,
            apiSecret,
            warning: api_credential_util_1.SECRET_ONCE_WARNING,
        };
    }
    async revoke(client, id) {
        const row = await this.requireOwned(client, id);
        if (row.revokedAt)
            return this.toListItem(row);
        const updated = await this.prisma.apiCredential.update({
            where: { id: row.id },
            data: {
                isActive: false,
                revokedAt: new Date(),
                revokedByUserId: client.id,
            },
        });
        return this.toListItem(updated);
    }
    async setEnabled(client, id, enabled) {
        const row = await this.requireOwned(client, id);
        if (row.revokedAt) {
            throw new common_1.ForbiddenException('A revoked API key cannot be enabled or disabled.');
        }
        const updated = await this.prisma.apiCredential.update({
            where: { id: row.id },
            data: { isActive: enabled },
        });
        return this.toListItem(updated);
    }
    async requireOwnedScope(client, id) {
        const row = await this.requireOwned(client, id);
        return row.scope;
    }
    async requireOwned(client, id) {
        assertClientAdmin(client);
        const row = await this.prisma.apiCredential.findFirst({
            where: { id, companyId: client.companyId },
        });
        if (!row)
            throw new common_1.NotFoundException('API credential not found.');
        return row;
    }
    toListItem(row) {
        return {
            id: row.id,
            name: row.name,
            scope: row.scope,
            status: statusOf(row),
            maskedKey: (0, api_credential_util_1.maskApiKey)(row.apiKey),
            createdAt: row.createdAt,
            lastUsedAt: row.lastUsedAt,
        };
    }
};
exports.ApiCredentialsService = ApiCredentialsService;
exports.ApiCredentialsService = ApiCredentialsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ApiCredentialsService);
//# sourceMappingURL=api-credentials.service.js.map