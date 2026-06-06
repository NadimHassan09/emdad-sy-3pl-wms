import { Injectable } from '@nestjs/common';

export type MaintenanceReason = 'backup_restore' | 'factory_reset' | null;

@Injectable()
export class BackupMaintenanceService {
  private active = false;
  private reason: MaintenanceReason = null;

  enable(reason: MaintenanceReason): void {
    this.active = true;
    this.reason = reason;
  }

  disable(): void {
    this.active = false;
    this.reason = null;
  }

  isActive(): boolean {
    return this.active;
  }

  getReason(): MaintenanceReason {
    return this.reason;
  }
}
