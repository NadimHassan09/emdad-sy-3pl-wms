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
Object.defineProperty(exports, "__esModule", { value: true });
exports.WarehousesService = void 0;
const common_1 = require("@nestjs/common");
const coerce_boolean_1 = require("../../common/utils/coerce-boolean");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const WAREHOUSE_CODE_LOCK_KEY = 0x57484344;
let WarehousesService = class WarehousesService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(dto) {
        return this.prisma.$transaction(async (tx) => {
            let code = dto.code?.trim();
            if (!code) {
                await tx.$executeRaw `SELECT pg_advisory_xact_lock(${WAREHOUSE_CODE_LOCK_KEY})`;
                code = await this.computeNextCode(tx);
            }
            return tx.warehouse.create({
                data: {
                    name: dto.name,
                    code,
                    address: dto.address,
                    city: dto.city,
                    country: dto.country ?? 'SA',
                },
            });
        });
    }
    list(query) {
        const includeInactive = (0, coerce_boolean_1.coerceOptionalBool)(query?.includeInactive) === true;
        const where = {};
        if (!includeInactive) {
            where.status = 'active';
        }
        return this.prisma.warehouse.findMany({ where, orderBy: { code: 'asc' } });
    }
    async findById(id) {
        const wh = await this.prisma.warehouse.findUnique({ where: { id } });
        if (!wh)
            throw new common_1.NotFoundException('Warehouse not found.');
        return wh;
    }
    async nextCode() {
        const code = await this.computeNextCode(this.prisma);
        return { code };
    }
    async setStatus(id, status) {
        await this.findById(id);
        return this.prisma.warehouse.update({ where: { id }, data: { status } });
    }
    async update(id, dto) {
        await this.findById(id);
        const data = {};
        if (dto.name !== undefined)
            data.name = dto.name;
        if (dto.address !== undefined)
            data.address = dto.address;
        if (dto.city !== undefined)
            data.city = dto.city;
        if (dto.country !== undefined)
            data.country = dto.country;
        if (Object.keys(data).length === 0) {
            return this.findById(id);
        }
        return this.prisma.warehouse.update({ where: { id }, data });
    }
    async softDelete(id) {
        await this.findById(id);
        const activeLocs = await this.prisma.location.count({
            where: {
                warehouseId: id,
                status: { not: 'archived' },
            },
        });
        if (activeLocs > 0) {
            throw new common_1.ConflictException('Cannot deactivate warehouse while non-archived locations exist.');
        }
        return this.prisma.warehouse.update({
            where: { id },
            data: { status: 'inactive' },
        });
    }
    async computeNextCode(client) {
        const rows = await client.$queryRaw `
      SELECT MAX(NULLIF(regexp_replace(code, '^WH-', ''), '')::int) AS max_n
        FROM warehouses
       WHERE code ~ '^WH-[0-9]+$'
    `;
        const next = (rows[0]?.max_n ?? 0) + 1;
        return `WH-${String(next).padStart(3, '0')}`;
    }
};
exports.WarehousesService = WarehousesService;
exports.WarehousesService = WarehousesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], WarehousesService);
//# sourceMappingURL=warehouses.service.js.map