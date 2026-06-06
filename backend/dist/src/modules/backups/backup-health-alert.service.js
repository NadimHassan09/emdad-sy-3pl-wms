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
var BackupHealthAlertService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BackupHealthAlertService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const client_1 = require("@prisma/client");
const audit_log_service_1 = require("../../common/audit/audit-log.service");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const backup_bootstrap_constants_1 = require("./backup-bootstrap.constants");
const backup_config_1 = require("./backup-config");
const backup_health_service_1 = require("./backup-health.service");
let BackupHealthAlertService = BackupHealthAlertService_1 = class BackupHealthAlertService {
    prisma;
    backupConfig;
    health;
    audit;
    logger = new common_1.Logger(BackupHealthAlertService_1.name);
    emitted = new Map();
    systemPrincipal = null;
    constructor(prisma, backupConfig, health, audit) {
        this.prisma = prisma;
        this.backupConfig = backupConfig;
        this.health = health;
        this.audit = audit;
    }
    async evaluateAndAlert() {
        if (!this.backupConfig.enabled || !this.backupConfig.healthMonitoringEnabled) {
            return;
        }
        const snapshot = await this.health.getHealth();
        const principal = await this.resolveSystemPrincipal();
        if (!principal) {
            this.logger.warn('Skipping backup health alerts — no active super_admin system user.');
            return;
        }
        if (snapshot.healthStatus === 'healthy') {
            this.emitted.clear();
            return;
        }
        const cooldownMs = this.backupConfig.healthAlertCooldownHours * 3_600_000;
        const now = Date.now();
        for (const alert of snapshot.alerts) {
            const key = `${alert.code}:${alert.severity}`;
            const previous = this.emitted.get(key);
            const shouldEmit = !previous ||
                (alert.severity === 'critical' && previous.severity !== 'critical') ||
                now - previous.lastEmittedAt >= cooldownMs;
            if (!shouldEmit)
                continue;
            const action = alert.severity === 'critical' ? 'backup.health.critical' : 'backup.health.warning';
            await this.audit.logBestEffort(this.audit.fromPrincipal(principal, {
                action,
                resourceType: 'backup_health',
                resourceId: backup_bootstrap_constants_1.BACKUP_HEALTH_RESOURCE_ID,
                newState: {
                    message: alert.message,
                    code: alert.code,
                    severity: alert.severity,
                    healthStatus: snapshot.healthStatus,
                    metrics: snapshot.metrics,
                },
            }));
            this.emitted.set(key, { severity: alert.severity, lastEmittedAt: now });
            this.logger.warn(`Backup health ${alert.severity}: ${alert.message}`);
        }
    }
    async evaluateNow() {
        await this.evaluateAndAlert();
        const snapshot = await this.health.getHealth();
        return { healthStatus: snapshot.healthStatus, alerts: snapshot.alerts };
    }
    async resolveSystemPrincipal() {
        if (this.systemPrincipal)
            return this.systemPrincipal;
        const user = await this.prisma.user.findFirst({
            where: { role: client_1.UserRole.super_admin, status: 'active' },
            orderBy: { createdAt: 'asc' },
            select: { id: true, email: true, role: true, companyId: true },
        });
        if (!user)
            return null;
        this.systemPrincipal = {
            id: user.id,
            email: user.email,
            role: user.role,
            companyId: user.companyId,
            tenantScope: 'all',
            authorizedCompanyIds: [],
        };
        return this.systemPrincipal;
    }
};
exports.BackupHealthAlertService = BackupHealthAlertService;
__decorate([
    (0, schedule_1.Cron)('*/15 * * * *'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], BackupHealthAlertService.prototype, "evaluateAndAlert", null);
exports.BackupHealthAlertService = BackupHealthAlertService = BackupHealthAlertService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        backup_config_1.BackupConfig,
        backup_health_service_1.BackupHealthService,
        audit_log_service_1.AuditLogService])
], BackupHealthAlertService);
//# sourceMappingURL=backup-health-alert.service.js.map