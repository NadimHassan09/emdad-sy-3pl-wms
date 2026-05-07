"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InboundModule = void 0;
const common_1 = require("@nestjs/common");
const inventory_module_1 = require("../inventory/inventory.module");
const warehouse_workflow_module_1 = require("../warehouse-workflow/warehouse-workflow.module");
const inbound_controller_1 = require("./inbound.controller");
const inbound_service_1 = require("./inbound.service");
let InboundModule = class InboundModule {
};
exports.InboundModule = InboundModule;
exports.InboundModule = InboundModule = __decorate([
    (0, common_1.Module)({
        imports: [inventory_module_1.InventoryModule, warehouse_workflow_module_1.WarehouseWorkflowModule],
        controllers: [inbound_controller_1.InboundController],
        providers: [inbound_service_1.InboundService],
    })
], InboundModule);
//# sourceMappingURL=inbound.module.js.map