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
exports.BackupMaintenanceMiddleware = void 0;
const common_1 = require("@nestjs/common");
const backup_maintenance_service_1 = require("./backup-maintenance.service");
let BackupMaintenanceMiddleware = class BackupMaintenanceMiddleware {
    maintenance;
    constructor(maintenance) {
        this.maintenance = maintenance;
    }
    use(req, res, next) {
        if (!this.maintenance.isActive()) {
            next();
            return;
        }
        const path = (req.originalUrl ?? req.url).split('?')[0] ?? '';
        if (this.isAllowedDuringMaintenance(req.method, path)) {
            next();
            return;
        }
        res.status(503).json({
            success: false,
            data: null,
            error: {
                code: 'MAINTENANCE',
                message: 'System is in maintenance mode for backup operations.',
                reason: this.maintenance.getReason() ?? 'backup_restore',
            },
        });
    }
    isAllowedDuringMaintenance(method, path) {
        if (method === 'GET' && path.startsWith('/api/ops/health/liveness'))
            return true;
        if (method === 'GET' && /^\/api\/backups\/[^/]+\/status$/.test(path))
            return true;
        if (method === 'GET' && path === '/api/backups/operations/active')
            return true;
        if (method === 'GET' && path === '/api/backups/health')
            return true;
        return false;
    }
};
exports.BackupMaintenanceMiddleware = BackupMaintenanceMiddleware;
exports.BackupMaintenanceMiddleware = BackupMaintenanceMiddleware = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [backup_maintenance_service_1.BackupMaintenanceService])
], BackupMaintenanceMiddleware);
//# sourceMappingURL=backup-maintenance.middleware.js.map