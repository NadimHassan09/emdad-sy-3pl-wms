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
var DashboardRealtimeService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardRealtimeService = void 0;
const common_1 = require("@nestjs/common");
const dashboard_service_1 = require("../dashboard/dashboard.service");
const realtime_service_1 = require("../realtime/realtime.service");
const STUB_USER = {
    id: '00000000-0000-4000-8000-000000000099',
    email: 'dashboard@system.local',
    role: 'super_admin',
    companyId: null,
};
let DashboardRealtimeService = DashboardRealtimeService_1 = class DashboardRealtimeService {
    dashboard;
    realtime;
    log = new common_1.Logger(DashboardRealtimeService_1.name);
    pending = new Set();
    flushTimer = null;
    constructor(dashboard, realtime) {
        this.dashboard = dashboard;
        this.realtime = realtime;
    }
    onModuleInit() {
        this.realtime.registerDashboardSchedule((section) => this.schedule(section));
    }
    schedule(section) {
        this.pending.add(section);
        if (this.flushTimer)
            return;
        this.flushTimer = setTimeout(() => {
            this.flushTimer = null;
            void this.flush();
        }, 200);
    }
    async flush() {
        const sections = new Set(this.pending);
        this.pending.clear();
        if (sections.size === 0)
            return;
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
        }
        catch (err) {
            this.log.warn(`Dashboard realtime flush failed: ${err instanceof Error ? err.message : String(err)}`);
        }
    }
    emitActiveUsers(activeUsers) {
        this.realtime.emitDashboardKpiUpdated({
            counters: { activeUsers },
        });
    }
};
exports.DashboardRealtimeService = DashboardRealtimeService;
exports.DashboardRealtimeService = DashboardRealtimeService = DashboardRealtimeService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [dashboard_service_1.DashboardService,
        realtime_service_1.RealtimeService])
], DashboardRealtimeService);
//# sourceMappingURL=dashboard-realtime.service.js.map