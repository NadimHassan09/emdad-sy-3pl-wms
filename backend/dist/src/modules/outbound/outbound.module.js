"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OutboundModule = void 0;
const common_1 = require("@nestjs/common");
const audit_module_1 = require("../../common/audit/audit.module");
const inventory_module_1 = require("../inventory/inventory.module");
const oms_module_1 = require("../oms/oms.module");
const shipping_module_1 = require("../shipping/shipping.module");
const warehouse_workflow_module_1 = require("../warehouse-workflow/warehouse-workflow.module");
const billing_module_1 = require("../billing/billing.module");
const client_portal_module_1 = require("../client-portal/client-portal.module");
const outbound_controller_1 = require("./outbound.controller");
const outbound_orders_csv_service_1 = require("./outbound-orders-csv.service");
const outbound_service_1 = require("./outbound.service");
let OutboundModule = class OutboundModule {
};
exports.OutboundModule = OutboundModule;
exports.OutboundModule = OutboundModule = __decorate([
    (0, common_1.Module)({
        imports: [
            inventory_module_1.InventoryModule,
            (0, common_1.forwardRef)(() => warehouse_workflow_module_1.WarehouseWorkflowModule),
            audit_module_1.AuditModule,
            billing_module_1.BillingModule,
            (0, common_1.forwardRef)(() => oms_module_1.OmsModule),
            (0, common_1.forwardRef)(() => shipping_module_1.ShippingModule),
            (0, common_1.forwardRef)(() => client_portal_module_1.ClientPortalModule),
        ],
        controllers: [outbound_controller_1.OutboundController],
        providers: [outbound_service_1.OutboundService, outbound_orders_csv_service_1.OutboundOrdersCsvService],
        exports: [outbound_service_1.OutboundService],
    })
], OutboundModule);
//# sourceMappingURL=outbound.module.js.map