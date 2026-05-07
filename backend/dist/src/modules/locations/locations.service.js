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
exports.LocationsService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const identifiers_1 = require("../../common/generators/identifiers");
const coerce_boolean_1 = require("../../common/utils/coerce-boolean");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const BARCODE_RETRY_LIMIT = 6;
function assertNotDeprecatedLocationType(type) {
    if (type !== undefined && type === client_1.LocationType.qc) {
        throw new common_1.BadRequestException('Location type QC is no longer supported. Use Quarantine, Storage, or another standard type.');
    }
}
let LocationsService = class LocationsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async assertParentChainValid(parentId, warehouseId) {
        const seen = new Set();
        let cur = parentId;
        let depth = 0;
        const maxDepth = 100;
        while (cur) {
            if (seen.has(cur)) {
                throw new common_1.BadRequestException('Circular location parent reference detected.');
            }
            seen.add(cur);
            if (++depth > maxDepth) {
                throw new common_1.BadRequestException('Location hierarchy exceeds maximum depth.');
            }
            const row = await this.prisma.location.findUnique({
                where: { id: cur },
                select: { parentId: true, warehouseId: true },
            });
            if (!row)
                throw new common_1.NotFoundException('Parent location not found.');
            if (row.warehouseId !== warehouseId) {
                throw new common_1.BadRequestException('Parent location belongs to a different warehouse.');
            }
            cur = row.parentId;
        }
    }
    async create(dto) {
        const warehouse = await this.prisma.warehouse.findUnique({
            where: { id: dto.warehouseId },
        });
        if (!warehouse)
            throw new common_1.NotFoundException('Warehouse not found.');
        assertNotDeprecatedLocationType(dto.type);
        let parent = null;
        if (dto.parentId) {
            await this.assertParentChainValid(dto.parentId, dto.warehouseId);
            parent = await this.prisma.location.findUnique({
                where: { id: dto.parentId },
                select: { id: true, warehouseId: true, fullPath: true, barcode: true },
            });
            if (!parent)
                throw new common_1.NotFoundException('Parent location not found.');
            if (parent.warehouseId !== dto.warehouseId) {
                throw new common_1.BadRequestException('Parent location belongs to a different warehouse.');
            }
        }
        const fullPath = parent
            ? `${parent.fullPath}/${dto.name}`
            : `${warehouse.code}/${dto.name}`;
        const explicitBarcode = dto.barcode?.trim();
        const baseCandidate = explicitBarcode
            ? explicitBarcode
            : this.buildHierarchicalBarcode(warehouse.code, parent?.barcode ?? null, dto.name);
        let lastError;
        const attempts = explicitBarcode ? 1 : BARCODE_RETRY_LIMIT;
        for (let i = 0; i < attempts; i++) {
            const candidate = i === 0 ? baseCandidate : `${baseCandidate}-${i + 1}`;
            try {
                return await this.prisma.location.create({
                    data: {
                        warehouseId: dto.warehouseId,
                        parentId: dto.parentId,
                        name: dto.name,
                        type: dto.type ?? 'internal',
                        barcode: candidate,
                        fullPath,
                        maxWeightKg: dto.maxWeightKg,
                        maxCbm: dto.maxCbm,
                    },
                });
            }
            catch (err) {
                lastError = err;
                if (err instanceof client_1.Prisma.PrismaClientKnownRequestError &&
                    err.code === 'P2002' &&
                    !explicitBarcode) {
                    continue;
                }
                throw err;
            }
        }
        throw lastError;
    }
    list(query) {
        const includeArchived = (0, coerce_boolean_1.coerceOptionalBool)(query.includeArchived) === true;
        const where = {};
        if (!includeArchived) {
            where.status = 'active';
        }
        if (query.warehouseId)
            where.warehouseId = query.warehouseId;
        return this.prisma.location.findMany({
            where,
            orderBy: [{ fullPath: 'asc' }],
        });
    }
    async tree(warehouseId) {
        const flat = await this.prisma.location.findMany({
            where: { warehouseId, status: 'active' },
            orderBy: { sortOrder: 'asc' },
        });
        const byId = new Map();
        flat.forEach((row) => byId.set(row.id, {
            id: row.id,
            name: row.name,
            fullPath: row.fullPath,
            type: row.type,
            barcode: row.barcode,
            children: [],
        }));
        const roots = [];
        flat.forEach((row) => {
            const node = byId.get(row.id);
            if (!node)
                return;
            if (row.parentId && byId.has(row.parentId)) {
                byId.get(row.parentId).children.push(node);
            }
            else {
                roots.push(node);
            }
        });
        return roots;
    }
    async findById(id) {
        const loc = await this.prisma.location.findUnique({ where: { id } });
        if (!loc)
            throw new common_1.NotFoundException('Location not found.');
        return loc;
    }
    async update(id, dto) {
        if (dto.status === 'archived') {
            throw new common_1.BadRequestException('Use DELETE to archive a location.');
        }
        const loc = await this.prisma.location.findUnique({
            where: { id },
            include: {
                warehouse: { select: { id: true, code: true } },
            },
        });
        if (!loc)
            throw new common_1.NotFoundException('Location not found.');
        assertNotDeprecatedLocationType(dto.type);
        let parentFullPath = null;
        if (loc.parentId) {
            const p = await this.prisma.location.findUnique({
                where: { id: loc.parentId },
                select: { fullPath: true },
            });
            parentFullPath = p?.fullPath ?? null;
        }
        const data = {};
        if (dto.barcode !== undefined)
            data.barcode = dto.barcode.trim();
        if (dto.sortOrder !== undefined)
            data.sortOrder = dto.sortOrder;
        if (dto.type !== undefined)
            data.type = dto.type;
        if (dto.status !== undefined)
            data.status = dto.status;
        if (dto.maxWeightKg !== undefined) {
            data.maxWeightKg = dto.maxWeightKg;
        }
        if (dto.maxCbm !== undefined) {
            data.maxCbm = dto.maxCbm;
        }
        if (dto.maxPalletPositions !== undefined) {
            data.maxPalletPositions = dto.maxPalletPositions;
        }
        const nameChanged = dto.name !== undefined && dto.name.trim() !== loc.name;
        const newName = nameChanged ? dto.name.trim() : loc.name;
        let remappedSubtreeRoot;
        if (nameChanged) {
            data.name = newName;
            const newFullPath = parentFullPath
                ? `${parentFullPath}/${newName}`
                : `${loc.warehouse.code}/${newName}`;
            data.fullPath = newFullPath;
            remappedSubtreeRoot = newFullPath;
        }
        if (Object.keys(data).length === 0) {
            return this.findById(id);
        }
        return this.prisma.$transaction(async (tx) => {
            try {
                await tx.location.update({ where: { id }, data });
            }
            catch (err) {
                if (err instanceof client_1.Prisma.PrismaClientKnownRequestError &&
                    err.code === 'P2002') {
                    throw new common_1.ConflictException('Barcode must be unique.');
                }
                throw err;
            }
            if (remappedSubtreeRoot) {
                await this.remapChildFullPaths(tx, id, remappedSubtreeRoot);
            }
            return tx.location.findUniqueOrThrow({ where: { id } });
        });
    }
    async remapChildFullPaths(tx, parentId, parentNewFullPath) {
        const children = await tx.location.findMany({
            where: { parentId },
            select: { id: true, name: true },
        });
        for (const ch of children) {
            const nextPath = `${parentNewFullPath}/${ch.name}`;
            await tx.location.update({
                where: { id: ch.id },
                data: { fullPath: nextPath },
            });
            await this.remapChildFullPaths(tx, ch.id, nextPath);
        }
    }
    async softDelete(id) {
        const loc = await this.findById(id);
        if (loc.status === 'archived') {
            return loc;
        }
        const stockRows = await this.prisma.currentStock.count({
            where: { locationId: id },
        });
        if (stockRows > 0) {
            throw new common_1.ConflictException('Cannot archive location while stock rows exist for it.');
        }
        return this.prisma.location.update({
            where: { id },
            data: { status: 'archived' },
        });
    }
    async purgeContext(warehouseId) {
        const withStock = await this.prisma.currentStock.groupBy({
            by: ['locationId'],
            where: {
                warehouseId,
                OR: [{ quantityOnHand: { gt: 0 } }, { quantityReserved: { gt: 0 } }],
            },
        });
        const adjLines = await this.prisma.stockAdjustmentLine.findMany({
            where: { location: { warehouseId } },
            select: { locationId: true },
        });
        const onAdjustments = [...new Set(adjLines.map((l) => l.locationId))];
        return {
            locationIdsWithStock: withStock.map((g) => g.locationId),
            locationIdsOnAdjustments: onAdjustments,
        };
    }
    async hardDeleteSubtree(rootId) {
        const root = await this.prisma.location.findUnique({
            where: { id: rootId },
            select: { id: true, warehouseId: true },
        });
        if (!root)
            throw new common_1.NotFoundException('Location not found.');
        const flat = await this.prisma.location.findMany({
            where: { warehouseId: root.warehouseId },
            select: { id: true, parentId: true },
        });
        const childrenByParent = new Map();
        for (const row of flat) {
            if (!row.parentId)
                continue;
            const arr = childrenByParent.get(row.parentId) ?? [];
            arr.push(row.id);
            childrenByParent.set(row.parentId, arr);
        }
        const subtree = new Set();
        const walk = (id) => {
            subtree.add(id);
            for (const c of childrenByParent.get(id) ?? [])
                walk(c);
        };
        walk(rootId);
        const ids = [...subtree];
        const parentById = new Map(flat.map((r) => [r.id, r.parentId]));
        for (const id of ids) {
            const busy = await this.prisma.currentStock.count({
                where: {
                    locationId: id,
                    OR: [{ quantityOnHand: { gt: 0 } }, { quantityReserved: { gt: 0 } }],
                },
            });
            if (busy > 0) {
                throw new common_1.ConflictException('Cannot delete: this location or a descendant still has on-hand or reserved stock.');
            }
            const adj = await this.prisma.stockAdjustmentLine.count({ where: { locationId: id } });
            if (adj > 0) {
                throw new common_1.ConflictException('Cannot delete: a location in this subtree is referenced on stock adjustment lines.');
            }
        }
        const depthUnderRoot = (id) => {
            let d = 0;
            let cur = id;
            while (cur !== rootId) {
                d += 1;
                cur = parentById.get(cur) ?? null;
                if (!cur)
                    return -1;
            }
            return d;
        };
        const ordered = [...ids].sort((a, b) => depthUnderRoot(b) - depthUnderRoot(a));
        await this.prisma.$transaction(async (tx) => {
            for (const id of ordered) {
                await tx.currentStock.deleteMany({ where: { locationId: id } });
                await tx.location.delete({ where: { id } });
            }
        });
        return { deletedIds: ordered };
    }
    buildHierarchicalBarcode(warehouseCode, parentBarcode, name) {
        const slug = (0, identifiers_1.slugifyForBarcode)(name) || 'LOC';
        if (!parentBarcode)
            return `${warehouseCode}-${slug}`;
        const prefix = parentBarcode.startsWith(`${warehouseCode}-`)
            ? parentBarcode
            : `${warehouseCode}-${parentBarcode}`;
        return `${prefix}-${slug}`;
    }
};
exports.LocationsService = LocationsService;
exports.LocationsService = LocationsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], LocationsService);
//# sourceMappingURL=locations.service.js.map