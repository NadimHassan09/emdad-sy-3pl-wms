import { Injectable } from '@nestjs/common';

@Injectable()
export class BackupOperationsService {
  private activeJobId: string | null = null;

  isBusy(): boolean {
    return this.activeJobId !== null;
  }

  getActiveJobId(): string | null {
    return this.activeJobId;
  }

  tryAcquire(jobId: string): boolean {
    if (this.activeJobId) return false;
    this.activeJobId = jobId;
    return true;
  }

  release(jobId: string): void {
    if (this.activeJobId === jobId) this.activeJobId = null;
  }
}
