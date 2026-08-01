"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OmsModule = void 0;
const common_1 = require("@nestjs/common");
const audit_module_1 = require("../../common/audit/audit.module");
const company_access_module_1 = require("../../common/company-access/company-access.module");
const outbound_module_1 = require("../outbound/outbound.module");
const realtime_module_1 = require("../realtime/realtime.module");
const oms_controller_1 = require("./oms.controller");
const oms_dashboard_service_1 = require("./oms-dashboard.service");
const oms_order_events_service_1 = require("./oms-order-events.service");
const oms_orders_service_1 = require("./oms-orders.service");
const oms_outbound_sync_service_1 = require("./oms-outbound-sync.service");
const oms_sales_channel_service_1 = require("./sales-channels/oms-sales-channel.service");
const oms_webhooks_controller_1 = require("./sales-channels/oms-webhooks.controller");
const order_allocation_service_1 = require("./order-allocation.service");
let OmsModule = class OmsModule {
};
exports.OmsModule = OmsModule;
exports.OmsModule = OmsModule = __decorate([
    (0, common_1.Module)({
        imports: [audit_module_1.AuditModule, company_access_module_1.CompanyAccessModule, realtime_module_1.RealtimeModule, (0, common_1.forwardRef)(() => outbound_module_1.OutboundModule)],
        controllers: [oms_controller_1.OmsController, oms_webhooks_controller_1.OmsWebhooksController],
        providers: [
            order_allocation_service_1.OrderAllocationService,
            oms_order_events_service_1.OmsOrderEventsService,
            oms_outbound_sync_service_1.OmsOutboundSyncService,
            oms_orders_service_1.OmsOrdersService,
            oms_dashboard_service_1.OmsDashboardService,
            oms_sales_channel_service_1.OmsSalesChannelService,
        ],
        exports: [
            order_allocation_service_1.OrderAllocationService,
            oms_order_events_service_1.OmsOrderEventsService,
            oms_outbound_sync_service_1.OmsOutboundSyncService,
            oms_orders_service_1.OmsOrdersService,
        ],
    })
], OmsModule);
//# sourceMappingURL=oms.module.js.map