import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { Socket } from 'socket.io';

import { AuthPrincipal } from '../../common/auth/current-user.types';
import { DashboardService } from '../dashboard/dashboard.service';
import { RealtimeService } from '../realtime/realtime.service';

type DashboardSection = 'orders' | 'tasks' | 'inventory' | 'kpi' | 'all';

const STUB_USER = {
  id: '00000000-0000-4000-8000-000000000099',
  email: 'dashboard@system.local',
  role: 'super_admin',
  companyId: null,
} as AuthPrincipal;

@Injectable()
export class DashboardRealtimeService implements OnModuleInit {
  private readonly log = new Logger(DashboardRealtimeService.name);
  private pending = new Set<DashboardSection>();
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly dashboard: DashboardService,
    private readonly realtime: RealtimeService,
  ) {}

  onModuleInit(): void {
    this.realtime.registerDashboardSchedule((section) => this.schedule(section));
  }

  schedule(section: DashboardSection): void {
    this.pending.add(section);
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      void this.flush();
    }, 200);
  }

  private async flush(): Promise<void> {
    const sections = new Set(this.pending);
    this.pending.clear();
    if (sections.size === 0) return;

    try {
      if (sections.has('orders') || sections.has('all')) {
        const [charts, overview] = await Promise.all([
          this.dashboard.openOrdersCharts(STUB_USER),
          this.dashboard.overview(STUB_USER),
        ]);
        this.realtime.emitDashboardOrdersUpdated({
          openOrders: overview.openOrders,
          openOrdersCharts: charts,
          recentOrders: overview.recentOrders,
        });
      }

      if (sections.has('tasks') || sections.has('all')) {
        const [charts, overview] = await Promise.all([
          this.dashboard.openOrdersCharts(STUB_USER),
          this.dashboard.overview(STUB_USER),
        ]);
        this.realtime.emitDashboardTasksUpdated({
          openTasksByType: overview.openTasksByType,
          openOrdersCharts: charts,
        });
      }

      if (sections.has('inventory') || sections.has('all')) {
        const overview = await this.dashboard.overview(STUB_USER);
        this.realtime.emitDashboardInventoryUpdated({
          counters: { totalItemsInStock: overview.counters.totalItemsInStock },
          capacity: overview.capacity,
          soonExpiryLots: overview.soonExpiryLots,
        });
      }

      if (sections.has('kpi') || sections.has('all')) {
        const overview = await this.dashboard.overview(STUB_USER);
        this.realtime.emitDashboardKpiUpdated({
          counters: overview.counters,
          openOrders: overview.openOrders,
        });
      }
    } catch (err) {
      this.log.warn(
        `Dashboard realtime flush failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  emitActiveUsers(activeUsers: number): void {
    this.realtime.emitDashboardKpiUpdated({
      counters: { activeUsers },
    });
  }
}
