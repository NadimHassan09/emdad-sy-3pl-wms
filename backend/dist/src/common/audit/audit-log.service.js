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
var AuditLogService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditLogService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
const realtime_service_1 = require("../../modules/realtime/realtime.service");
const realtime_activity_payload_1 = require("../../modules/realtime/realtime-activity.payload");
let AuditLogService = AuditLogService_1 = class AuditLogService {
    prisma;
    realtime;
    logger = new common_1.Logger(AuditLogService_1.name);
    constructor(prisma, realtime) {
        this.prisma = prisma;
        this.realtime = realtime;
    }
    async log(input) {
        const row = await this.insert(this.prisma, input);
        this.scheduleAuditEmit(row);
    }
    async logTx(tx, input) {
        const row = await this.insert(tx, input);
        this.scheduleAuditEmit(row);
    }
    async logBestEffort(input) {
        try {
            await this.log(input);
        }
        catch (err) {
            this.logger.error(`Audit insert failed action=${input.action} resource=${input.resourceType}/${input.resourceId}`, err instanceof Error ? err.stack : String(err));
        }
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
    scheduleAuditEmit(row) {
        setTimeout(() => {
            try {
                const auditLog = (0, realtime_activity_payload_1.auditLogSummaryPayload)(row);
                this.realtime.emitAuditLogCreated(auditLog, row.company_id);
            }
            catch (err) {
                this.logger.warn(`Audit realtime emit failed id=${row.id}: ${err instanceof Error ? err.message : String(err)}`);
            }
        }, 0);
    }
    async insert(db, input) {
        if (!input.action?.trim() || !input.resourceType?.trim() || !input.resourceId?.trim()) {
            throw new Error('Audit log requires action, resourceType, and resourceId.');
        }
        if (!input.actorEmail?.trim() || !input.actorRole?.trim()) {
            throw new Error('Audit log requires actorEmail and actorRole.');
        }
        const rows = await db.$queryRaw(client_1.Prisma.sql `
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
        RETURNING
          id,
          actor_id,
          actor_email,
          actor_name,
          actor_role,
          company_id,
          action,
          resource_type,
          resource_id,
          ip_address,
          created_at
      `);
        const row = rows[0];
        if (!row)
            throw new Error('Audit log insert returned no row.');
        return row;
    }
};
exports.AuditLogService = AuditLogService;
exports.AuditLogService = AuditLogService = AuditLogService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        realtime_service_1.RealtimeService])
], AuditLogService);
//# sourceMappingURL=audit-log.service.js.map