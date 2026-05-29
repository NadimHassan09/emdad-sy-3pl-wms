"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReturnsModule = void 0;
const common_1 = require("@nestjs/common");
const audit_module_1 = require("../../common/audit/audit.module");
const inventory_module_1 = require("../inventory/inventory.module");
const return_inventory_service_1 = require("./return-inventory.service");
const return_quantity_validation_1 = require("./return-quantity.validation");
const return_workflow_service_1 = require("./return-workflow.service");
const returns_controller_1 = require("./returns.controller");
const returns_service_1 = require("./returns.service");
let ReturnsModule = class ReturnsModule {
};
exports.ReturnsModule = ReturnsModule;
exports.ReturnsModule = ReturnsModule = __decorate([
    (0, common_1.Module)({
        imports: [inventory_module_1.InventoryModule, audit_module_1.AuditModule],
        controllers: [returns_controller_1.ReturnsController],
        providers: [
            returns_service_1.ReturnsService,
            return_quantity_validation_1.ReturnQuantityValidation,
            return_workflow_service_1.ReturnWorkflowService,
            return_inventory_service_1.ReturnInventoryService,
        ],
        exports: [returns_service_1.ReturnsService],
    })
], ReturnsModule);
//# sourceMappingURL=returns.module.js.map