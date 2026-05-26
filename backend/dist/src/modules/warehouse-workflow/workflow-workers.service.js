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
exports.WorkflowWorkersService = void 0;
const common_1 = require("@nestjs/common");
const company_access_service_1 = require("../../common/company-access/company-access.service");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const client_1 = require("@prisma/client");
let WorkflowWorkersService = class WorkflowWorkersService {
    prisma;
    companyAccess;
    constructor(prisma, companyAccess) {
        this.prisma = prisma;
        this.companyAccess = companyAccess;
    }
    async list(user, warehouseId) {
        const tenantCompanyId = this.companyAccess.getReadFilterCompanyId(user);
        if (!tenantCompanyId)
            return [];
        const where = {
            companyId: tenantCompanyId,
            status: client_1.WorkerOperationalStatus.active,
            userId: { not: null },
            user: {
                companyId: null,
                role: client_1.UserRole.wh_operator,
                status: client_1.UserStatus.active,
            },
        };
        if (warehouseId) {
            where.OR = [{ warehouseId }, { warehouseId: null }];
        }
        return this.prisma.worker.findMany({
            where,
            include: { roles: true, user: { select: { id: true, email: true, fullName: true, role: true } } },
            orderBy: { displayName: 'asc' },
        });
    }
    async create(user, dto) {
        const tenantCompanyId = this.companyAccess.requireActiveTenant(user);
        return this.prisma.worker.create({
            data: {
                companyId: tenantCompanyId,
                warehouseId: dto.warehouseId,
                displayName: dto.displayName,
                roles: {
                    createMany: {
                        data: dto.roles.map((role) => ({ role })),
                    },
                },
            },
            include: { roles: true },
        });
    }
    async workerLoad(user, warehouseId) {
        const tenantCompanyId = this.companyAccess.requireActiveTenant(user, 'An active client tenant is required for worker load.');
        const whFilter = warehouseId
            ? client_1.Prisma.sql `AND (w.warehouse_id = ${warehouseId}::uuid OR w.warehouse_id IS NULL)`
            : client_1.Prisma.empty;
        const rows = await this.prisma.$queryRaw(client_1.Prisma.sql `
      SELECT
        v.worker_id,
        v.full_name,
        v.in_progress_count,
        v.assigned_pending_count,
        v.load_score
      FROM v_wms_worker_load v
      INNER JOIN workers w ON w.id = v.worker_id
      INNER JOIN users u ON u.id = w.user_id
      WHERE w.company_id = ${tenantCompanyId}::uuid
        AND w.status = 'active'::worker_operational_status
        AND w.user_id IS NOT NULL
        AND u.company_id IS NULL
        AND u.role = ${client_1.UserRole.wh_operator}::user_role
        AND u.status = 'active'::user_status
      ${whFilter}
      ORDER BY v.load_score DESC NULLS LAST, v.full_name ASC
    `);
        return rows.map((r) => ({
            workerId: r.worker_id,
            displayName: r.full_name ?? '',
            inProgressCount: Number(r.in_progress_count ?? 0),
            assignedPendingCount: Number(r.assigned_pending_count ?? 0),
            loadScore: Number(r.load_score ?? 0),
        }));
    }
    async get(workerId, user) {
        const w = await this.prisma.worker.findUnique({
            where: { id: workerId },
            include: {
                roles: true,
                taskAssignments: {
                    where: { unassignedAt: null },
                    take: 20,
                    include: { task: true },
                },
            },
        });
        if (!w) {
            throw new common_1.NotFoundException('Worker not found.');
        }
        this.companyAccess.validateResourceOwnership(user, w);
        const openTaskCount = await this.prisma.taskAssignment.count({
            where: { workerId, unassignedAt: null },
        });
        return { ...w, openTaskCount };
    }
};
exports.WorkflowWorkersService = WorkflowWorkersService;
exports.WorkflowWorkersService = WorkflowWorkersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        company_access_service_1.CompanyAccessService])
], WorkflowWorkersService);
//# sourceMappingURL=workflow-workers.service.js.map