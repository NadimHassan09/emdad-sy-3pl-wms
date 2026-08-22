import { Controller, Get, Query, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { AuthPrincipal } from '../../common/auth/current-user.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PresenceService } from './presence.service';
import { ModuleVersionsService } from './sync/module-versions.service';
import { RealtimeSyncModeService } from './sync/realtime-sync-mode.service';

@Controller('realtime')
@UseGuards(JwtAuthGuard)
export class RealtimeVersionController {
  constructor(
    private readonly versions: ModuleVersionsService,
    private readonly syncMode: RealtimeSyncModeService,
    private readonly presence: PresenceService,
  ) {}

  /**
   * Bootstrap current sequence + optional module version snapshot.
   * Query: domain=admin|client ; companyId required for client domain.
   */
  @Get('version')
  async getVersion(
    @CurrentUser() user: AuthPrincipal,
    @Query('domain') domain?: string,
    @Query('companyId') companyId?: string,
  ) {
    const mode = this.syncMode.getMode();
    const isClientRole = user.role === 'client_admin' || user.role === 'client_staff';
    const resolvedDomain =
      domain === 'client' || domain === 'admin'
        ? domain
        : isClientRole
          ? 'client'
          : 'admin';

    if (resolvedDomain === 'client') {
      const cid = (companyId || user.companyId || '').trim();
      const snap = await this.versions.snapshotClient(cid);
      return {
        success: true,
        data: {
          domain: 'client' as const,
          companyId: cid || null,
          version: snap.sequence,
          moduleVersions: snap.moduleVersions,
          mode,
        },
      };
    }

    const snap = await this.versions.snapshotAdmin();
    return {
      success: true,
      data: {
        domain: 'admin' as const,
        version: snap.sequence,
        moduleVersions: snap.moduleVersions,
        mode,
      },
    };
  }

  /** Snapshot of currently connected users (admin presence indicators). */
  @Get('presence/online')
  getOnlinePresence(@CurrentUser() user: AuthPrincipal) {
    const isClient = user.role === 'client_admin' || user.role === 'client_staff';
    if (isClient) {
      return { success: true, data: { userIds: [] as string[] } };
    }
    return {
      success: true,
      data: { userIds: this.presence.getOnlineUserIds() },
    };
  }
}
