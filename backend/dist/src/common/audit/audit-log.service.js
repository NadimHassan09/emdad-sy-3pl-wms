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
exports.AuditLogService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
let AuditLogService = class AuditLogService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async log(input) {
        await this.insert(this.prisma, input);
    }
    async logTx(tx, input) {
        await this.insert(tx, input);
    }
    fromPrincipal(principal, patch) {
        return {
            actorId: principal.id,
            actorEmail: principal.email ?? `user-${principal.id}@unknown.local`,
            actorName: principal.email ?? principal.id,
            actorRole: principal.role,
            companyId: patch.companyId ?? principal.companyId ?? null,
            ...patch,
        };
    }
    async insert(db, input) {
        await db.$executeRaw(client_1.Prisma.sql `
        INSERT INTO audit_logs (
          actor_id,
          actor_email,
          actor_name,
          actor_role,
          company_id,
          action,
          resource_type,
          resource_id,
          previous_state,
          new_state,
          ip_address,
          user_agent
        ) VALUES (
          ${input.actorId ?? null}::uuid,
          ${input.actorEmail},
          ${input.actorName},
          ${input.actorRole},
          ${input.companyId ?? null}::uuid,
          ${input.action},
          ${input.resourceType},
          ${input.resourceId}::uuid,
          ${input.previousState ? JSON.stringify(input.previousState) : null}::jsonb,
          ${input.newState ? JSON.stringify(input.newState) : null}::jsonb,
          ${input.ipAddress ?? null},
          ${input.userAgent ?? null}
        )
      `);
    }
};
exports.AuditLogService = AuditLogService;
exports.AuditLogService = AuditLogService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AuditLogService);
//# sourceMappingURL=audit-log.service.js.map