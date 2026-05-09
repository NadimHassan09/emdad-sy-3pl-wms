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
const inventory_module_1 = require("../inventory/inventory.module");
const warehouse_workflow_module_1 = require("../warehouse-workflow/warehouse-workflow.module");
const outbound_controller_1 = require("./outbound.controller");
const outbound_service_1 = require("./outbound.service");
let OutboundModule = class OutboundModule {
};
exports.OutboundModule = OutboundModule;
exports.OutboundModule = OutboundModule = __decorate([
    (0, common_1.Module)({
        imports: [inventory_module_1.InventoryModule, warehouse_workflow_module_1.WarehouseWorkflowModule],
        controllers: [outbound_controller_1.OutboundController],
        providers: [outbound_service_1.OutboundService],
        exports: [outbound_service_1.OutboundService],
    })
], OutboundModule);
//# sourceMappingURL=outbound.module.js.map