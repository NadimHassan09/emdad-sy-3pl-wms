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
exports.LocationsController = void 0;
const common_1 = require("@nestjs/common");
const parse_uuid_loose_pipe_1 = require("../../common/pipes/parse-uuid-loose.pipe");
const create_location_dto_1 = require("./dto/create-location.dto");
const list_locations_query_dto_1 = require("./dto/list-locations-query.dto");
const update_location_dto_1 = require("./dto/update-location.dto");
const locations_service_1 = require("./locations.service");
let LocationsController = class LocationsController {
    locations;
    constructor(locations) {
        this.locations = locations;
    }
    create(dto) {
        return this.locations.create(dto);
    }
    list(query) {
        return this.locations.list(query);
    }
    tree(warehouseId) {
        if (!warehouseId) {
            throw new common_1.BadRequestException('warehouseId query param is required for tree view.');
        }
        return this.locations.tree(warehouseId);
    }
    purgeContext(warehouseId) {
        if (!warehouseId) {
            throw new common_1.BadRequestException('warehouseId query param is required.');
        }
        return this.locations.purgeContext(warehouseId);
    }
    update(id, dto) {
        return this.locations.update(id, dto);
    }
    permanentRemove(id) {
        return this.locations.hardDeleteSubtree(id);
    }
    remove(id) {
        return this.locations.softDelete(id);
    }
    findOne(id) {
        return this.locations.findById(id);
    }
};
exports.LocationsController = LocationsController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_location_dto_1.CreateLocationDto]),
    __metadata("design:returntype", void 0)
], LocationsController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [list_locations_query_dto_1.ListLocationsQueryDto]),
    __metadata("design:returntype", void 0)
], LocationsController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('tree'),
    __param(0, (0, common_1.Query)('warehouseId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], LocationsController.prototype, "tree", null);
__decorate([
    (0, common_1.Get)('purge-context'),
    __param(0, (0, common_1.Query)('warehouseId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], LocationsController.prototype, "purgeContext", null);
__decorate([
    (0, common_1.Patch)(':id'),
    __param(0, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_location_dto_1.UpdateLocationDto]),
    __metadata("design:returntype", void 0)
], LocationsController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id/permanent'),
    __param(0, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], LocationsController.prototype, "permanentRemove", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], LocationsController.prototype, "remove", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], LocationsController.prototype, "findOne", null);
exports.LocationsController = LocationsController = __decorate([
    (0, common_1.Controller)('locations'),
    __metadata("design:paramtypes", [locations_service_1.LocationsService])
], LocationsController);
//# sourceMappingURL=locations.controller.js.map