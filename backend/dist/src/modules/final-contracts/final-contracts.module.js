"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FinalContractsModule = void 0;
const common_1 = require("@nestjs/common");
const final_contracts_controller_1 = require("./final-contracts.controller");
const final_contracts_service_1 = require("./final-contracts.service");
let FinalContractsModule = class FinalContractsModule {
};
exports.FinalContractsModule = FinalContractsModule;
exports.FinalContractsModule = FinalContractsModule = __decorate([
    (0, common_1.Module)({
        controllers: [final_contracts_controller_1.FinalContractsController],
        providers: [final_contracts_service_1.FinalContractsService],
        exports: [final_contracts_service_1.FinalContractsService],
    })
], FinalContractsModule);
//# sourceMappingURL=final-contracts.module.js.map