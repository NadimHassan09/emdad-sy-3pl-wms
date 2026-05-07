"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompaniesController = void 0;
const common_1 = require("@nestjs/common");
const auth_groups_1 = require("../../common/auth/auth-groups");
const roles_decorator_1 = require("../../common/auth/roles.decorator");
const roles_guard_1 = require("../../common/auth/roles.guard");
const parse_uuid_loose_pipe_1 = require("../../common/pipes/parse-uuid-loose.pipe");
const companies_service_1 = require("./companies.service");
const create_company_dto_1 = require("./dto/create-company.dto");
const list_companies_query_dto_1 = require("./dto/list-companies-query.dto");
const update_company_dto_1 = require("./dto/update-company.dto");
let CompaniesController = class CompaniesController {
    companies;
    constructor(companies) {
        this.companies = companies;
    }
    list(query) {
        return this.companies.list(query);
    }
    findOne(id) {
        return this.companies.findById(id);
    }
    create(dto) {
        return this.companies.create(dto);
    }
    update(id, dto) {
        return this.companies.update(id, dto);
    }
    suspend(id) {
        return this.companies.suspend(id);
    }
    close(id) {
        return this.companies.softDelete(id);
    }
    remove(id) {
        return this.companies.remove(id);
    }
};
exports.CompaniesController = CompaniesController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [list_companies_query_dto_1.ListCompaniesQueryDto]),
    __metadata("design:returntype", void 0)
], CompaniesController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], CompaniesController.prototype, "findOne", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_company_dto_1.CreateCompanyDto]),
    __metadata("design:returntype", void 0)
], CompaniesController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(':id'),
    __param(0, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_company_dto_1.UpdateCompanyDto]),
    __metadata("design:returntype", void 0)
], CompaniesController.prototype, "update", null);
__decorate([
    (0, common_1.Post)(':id/suspend'),
    __param(0, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], CompaniesController.prototype, "suspend", null);
__decorate([
    (0, common_1.Post)(':id/close'),
    __param(0, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], CompaniesController.prototype, "close", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(auth_groups_1.AuthGroup.ADMIN),
    __param(0, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], CompaniesController.prototype, "remove", null);
exports.CompaniesController = CompaniesController = __decorate([
    (0, common_1.Controller)('companies'),
    __metadata("design:paramtypes", [companies_service_1.CompaniesService])
], CompaniesController);
//# sourceMappingURL=companies.controller.js.map