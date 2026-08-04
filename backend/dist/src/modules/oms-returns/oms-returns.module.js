"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OmsReturnsModule = void 0;
const common_1 = require("@nestjs/common");
const company_access_module_1 = require("../../common/company-access/company-access.module");
const cod_module_1 = require("../cod/cod.module");
const returns_module_1 = require("../returns/returns.module");
const oms_returns_controller_1 = require("./oms-returns.controller");
const oms_returns_service_1 = require("./oms-returns.service");
let OmsReturnsModule = class OmsReturnsModule {
};
exports.OmsReturnsModule = OmsReturnsModule;
exports.OmsReturnsModule = OmsReturnsModule = __decorate([
    (0, common_1.Module)({
        imports: [
            company_access_module_1.CompanyAccessModule,
            cod_module_1.CodModule,
            (0, common_1.forwardRef)(() => returns_module_1.ReturnsModule),
        ],
        controllers: [oms_returns_controller_1.OmsReturnsController],
        providers: [oms_returns_service_1.OmsReturnsService],
        exports: [oms_returns_service_1.OmsReturnsService],
    })
], OmsReturnsModule);
//# sourceMappingURL=oms-returns.module.js.map