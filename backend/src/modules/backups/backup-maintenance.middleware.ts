import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

import { BackupMaintenanceService } from './backup-maintenance.service';

@Injectable()
export class BackupMaintenanceMiddleware implements NestMiddleware {
  constructor(private readonly maintenance: BackupMaintenanceService) {}

  use(req: Request, res: Response, next: NextFunction): void {
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

  private isAllowedDuringMaintenance(method: string, path: string): boolean {
    if (method === 'GET' && path.startsWith('/api/ops/health/liveness')) return true;
    if (method === 'GET' && /^\/api\/backups\/[^/]+\/status$/.test(path)) return true;
    if (method === 'GET' && path === '/api/backups/operations/active') return true;
    if (method === 'GET' && path === '/api/backups/health') return true;
    return false;
  }
}
