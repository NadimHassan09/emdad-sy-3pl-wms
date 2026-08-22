"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrdersModule = void 0;
const common_1 = require("@nestjs/common");
const inbound_module_1 = require("../inbound/inbound.module");
const outbound_module_1 = require("../outbound/outbound.module");
const warehouse_workflow_module_1 = require("../warehouse-workflow/warehouse-workflow.module");
let OrdersModule = class OrdersModule {
};
exports.OrdersModule = OrdersModule;
exports.OrdersModule = OrdersModule = __decorate([
    (0, common_1.Module)({
        imports: [
            (0, common_1.forwardRef)(() => inbound_module_1.InboundModule),
            (0, common_1.forwardRef)(() => outbound_module_1.OutboundModule),
            warehouse_workflow_module_1.WarehouseWorkflowModule,
        ],
        providers: [],
        exports: [],
    })
], OrdersModule);
//# sourceMappingURL=orders.module.js.map