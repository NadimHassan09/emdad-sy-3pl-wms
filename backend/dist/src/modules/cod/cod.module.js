"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CodModule = void 0;
const common_1 = require("@nestjs/common");
const company_access_module_1 = require("../../common/company-access/company-access.module");
const cod_controller_1 = require("./cod.controller");
const cod_records_service_1 = require("./cod-records.service");
let CodModule = class CodModule {
};
exports.CodModule = CodModule;
exports.CodModule = CodModule = __decorate([
    (0, common_1.Module)({
        imports: [company_access_module_1.CompanyAccessModule],
        controllers: [cod_controller_1.CodController],
        providers: [cod_records_service_1.CodRecordsService],
        exports: [cod_records_service_1.CodRecordsService],
    })
], CodModule);
//# sourceMappingURL=cod.module.js.map