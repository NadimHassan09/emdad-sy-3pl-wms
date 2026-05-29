"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CycleCountModule = void 0;
const common_1 = require("@nestjs/common");
const cycle_count_controller_1 = require("./cycle-count.controller");
const cycle_count_execution_controller_1 = require("./cycle-count-execution.controller");
const cycle_count_execution_service_1 = require("./cycle-count-execution.service");
const cycle_count_line_mutation_service_1 = require("./cycle-count-line-mutation.service");
const cycle_count_scheduler_service_1 = require("./cycle-count-scheduler.service");
const cycle_count_snapshot_service_1 = require("./cycle-count-snapshot.service");
const cycle_count_service_1 = require("./cycle-count.service");
const cycle_count_variance_controller_1 = require("./cycle-count-variance.controller");
const cycle_count_variance_detection_service_1 = require("./cycle-count-variance-detection.service");
const cycle_count_variance_service_1 = require("./cycle-count-variance.service");
const adjustments_module_1 = require("../adjustments/adjustments.module");
const audit_module_1 = require("../../common/audit/audit.module");
let CycleCountModule = class CycleCountModule {
};
exports.CycleCountModule = CycleCountModule;
exports.CycleCountModule = CycleCountModule = __decorate([
    (0, common_1.Module)({
        imports: [adjustments_module_1.AdjustmentsModule, audit_module_1.AuditModule],
        controllers: [
            cycle_count_controller_1.CycleCountController,
            cycle_count_execution_controller_1.CycleCountExecutionController,
            cycle_count_variance_controller_1.CycleCountVarianceController,
        ],
        providers: [
            cycle_count_service_1.CycleCountService,
            cycle_count_execution_service_1.CycleCountExecutionService,
            cycle_count_line_mutation_service_1.CycleCountLineMutationService,
            cycle_count_snapshot_service_1.CycleCountSnapshotService,
            cycle_count_scheduler_service_1.CycleCountSchedulerService,
            cycle_count_variance_detection_service_1.CycleCountVarianceDetectionService,
            cycle_count_variance_service_1.CycleCountVarianceService,
        ],
        exports: [cycle_count_service_1.CycleCountService, cycle_count_execution_service_1.CycleCountExecutionService, cycle_count_variance_service_1.CycleCountVarianceService],
    })
], CycleCountModule);
//# sourceMappingURL=cycle-count.module.js.map