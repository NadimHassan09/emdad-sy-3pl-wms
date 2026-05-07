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
exports.WarehousesController = void 0;
const common_1 = require("@nestjs/common");
const parse_uuid_loose_pipe_1 = require("../../common/pipes/parse-uuid-loose.pipe");
const create_warehouse_dto_1 = require("./dto/create-warehouse.dto");
const list_warehouses_query_dto_1 = require("./dto/list-warehouses-query.dto");
const update_warehouse_dto_1 = require("./dto/update-warehouse.dto");
const update_warehouse_status_dto_1 = require("./dto/update-warehouse-status.dto");
const warehouses_service_1 = require("./warehouses.service");
let WarehousesController = class WarehousesController {
    warehouses;
    constructor(warehouses) {
        this.warehouses = warehouses;
    }
    create(dto) {
        return this.warehouses.create(dto);
    }
    list(query) {
        return this.warehouses.list(query);
    }
    nextCode() {
        return this.warehouses.nextCode();
    }
    update(id, dto) {
        return this.warehouses.update(id, dto);
    }
    remove(id) {
        return this.warehouses.softDelete(id);
    }
    findOne(id) {
        return this.warehouses.findById(id);
    }
    setStatus(id, dto) {
        return this.warehouses.setStatus(id, dto.status);
    }
};
exports.WarehousesController = WarehousesController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_warehouse_dto_1.CreateWarehouseDto]),
    __metadata("design:returntype", void 0)
], WarehousesController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [list_warehouses_query_dto_1.ListWarehousesQueryDto]),
    __metadata("design:returntype", void 0)
], WarehousesController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('next-code'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], WarehousesController.prototype, "nextCode", null);
__decorate([
    (0, common_1.Patch)(':id'),
    __param(0, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_warehouse_dto_1.UpdateWarehouseDto]),
    __metadata("design:returntype", void 0)
], WarehousesController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], WarehousesController.prototype, "remove", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], WarehousesController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':id/status'),
    __param(0, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_warehouse_status_dto_1.UpdateWarehouseStatusDto]),
    __metadata("design:returntype", void 0)
], WarehousesController.prototype, "setStatus", null);
exports.WarehousesController = WarehousesController = __decorate([
    (0, common_1.Controller)('warehouses'),
    __metadata("design:paramtypes", [warehouses_service_1.WarehousesService])
], WarehousesController);
//# sourceMappingURL=warehouses.controller.js.map