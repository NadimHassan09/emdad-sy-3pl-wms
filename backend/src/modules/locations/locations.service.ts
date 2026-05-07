import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LocationType, Prisma } from '@prisma/client';

import { slugifyForBarcode } from '../../common/generators/identifiers';
import { coerceOptionalBool } from '../../common/utils/coerce-boolean';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateLocationDto } from './dto/create-location.dto';
import { ListLocationsQueryDto } from './dto/list-locations-query.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
interface LocationTreeNode {
  id: string;
  name: string;
  fullPath: string;
  type: string;
  barcode: string;
  children: LocationTreeNode[];
}

const BARCODE_RETRY_LIMIT = 6;

function assertNotDeprecatedLocationType(type: LocationType | undefined) {
  if (type !== undefined && type === LocationType.qc) {
    throw new BadRequestException(
      'Location type QC is no longer supported. Use Quarantine, Storage, or another standard type.',
    );
  }
}

@Injectable()
export class LocationsService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertParentChainValid(parentId: string, warehouseId: string) {
    const seen = new Set<string>();
    let cur: string | null = parentId;
    let depth = 0;
    const maxDepth = 100;
    while (cur) {
      if (seen.has(cur)) {
        throw new BadRequestException('Circular location parent reference detected.');
      }
      seen.add(cur);
      if (++depth > maxDepth) {
        throw new BadRequestException('Location hierarchy exceeds maximum depth.');
      }
      const row: {
        parentId: string | null;
        warehouseId: string;
      } | null = await this.prisma.location.findUnique({
        where: { id: cur },
        select: { parentId: true, warehouseId: true },
      });
      if (!row) throw new NotFoundException('Parent location not found.');
      if (row.warehouseId !== warehouseId) {
        throw new BadRequestException('Parent location belongs to a different warehouse.');
      }
      cur = row.parentId;
    }
  }

  async create(dto: CreateLocationDto) {
    const warehouse = await this.prisma.warehouse.findUnique({
      where: { id: dto.warehouseId },
    });
    if (!warehouse) throw new NotFoundException('Warehouse not found.');

    assertNotDeprecatedLocationType(dto.type);

    let parent: { id: string; warehouseId: string; fullPath: string; barcode: string } | null = null;
    if (dto.parentId) {
      await this.assertParentChainValid(dto.parentId, dto.warehouseId);
      parent = await this.prisma.location.findUnique({
        where: { id: dto.parentId },
        select: { id: true, warehouseId: true, fullPath: true, barcode: true },
      });
      if (!parent) throw new NotFoundException('Parent location not found.');
      if (parent.warehouseId !== dto.warehouseId) {
        throw new BadRequestException('Parent location belongs to a different warehouse.');
      }
    }

    const fullPath = parent
      ? `${parent.fullPath}/${dto.name}`
      : `${warehouse.code}/${dto.name}`;

    const explicitBarcode = dto.barcode?.trim();
    const baseCandidate = explicitBarcode
      ? explicitBarcode
      : this.buildHierarchicalBarcode(warehouse.code, parent?.barcode ?? null, dto.name);

    let lastError: unknown;
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
      } catch (err) {
        lastError = err;
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002' &&
          !explicitBarcode
        ) {
          continue;
        }
        throw err;
      }
    }
    throw lastError;
  }

  list(query: ListLocationsQueryDto) {
    const includeArchived = coerceOptionalBool(query.includeArchived) === true;
    const where: Prisma.LocationWhereInput = {};
    if (!includeArchived) {
      where.status = 'active';
    }
    if (query.warehouseId) where.warehouseId = query.warehouseId;
    return this.prisma.location.findMany({
      where,
      orderBy: [{ fullPath: 'asc' }],
    });
  }

  async tree(warehouseId: string): Promise<LocationTreeNode[]> {
    const flat = await this.prisma.location.findMany({
      where: { warehouseId, status: 'active' },
      orderBy: { sortOrder: 'asc' },
    });
    const byId = new Map<string, LocationTreeNode>();
    flat.forEach((row) =>
      byId.set(row.id, {
        id: row.id,
        name: row.name,
        fullPath: row.fullPath,
        type: row.type,
        barcode: row.barcode,
        children: [],
      }),
    );

    const roots: LocationTreeNode[] = [];
    flat.forEach((row) => {
      const node = byId.get(row.id);
      if (!node) return;
      if (row.parentId && byId.has(row.parentId)) {
        byId.get(row.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    });

    return roots;
  }

  async findById(id: string) {
    const loc = await this.prisma.location.findUnique({ where: { id } });
    if (!loc) throw new NotFoundException('Location not found.');
    return loc;
  }

  async update(id: string, dto: UpdateLocationDto) {
    if (dto.status === 'archived') {
      throw new BadRequestException('Use DELETE to archive a location.');
    }

    const loc = await this.prisma.location.findUnique({
      where: { id },
      include: {
        warehouse: { select: { id: true, code: true } },
      },
    });
    if (!loc) throw new NotFoundException('Location not found.');

    assertNotDeprecatedLocationType(dto.type);

    let parentFullPath: string | null = null;
    if (loc.parentId) {
      const p = await this.prisma.location.findUnique({
        where: { id: loc.parentId },
        select: { fullPath: true },
      });
      parentFullPath = p?.fullPath ?? null;
    }

    const data: Prisma.LocationUpdateInput = {};
    if (dto.barcode !== undefined) data.barcode = dto.barcode.trim();
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.maxWeightKg !== undefined) {
      data.maxWeightKg = dto.maxWeightKg;
    }
    if (dto.maxCbm !== undefined) {
      data.maxCbm = dto.maxCbm;
    }
    if (dto.maxPalletPositions !== undefined) {
      data.maxPalletPositions = dto.maxPalletPositions;
    }

    const nameChanged =
      dto.name !== undefined && dto.name.trim() !== loc.name;
    const newName = nameChanged ? dto.name!.trim() : loc.name;
    let remappedSubtreeRoot: string | undefined;
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
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002'
        ) {
          throw new ConflictException('Barcode must be unique.');
        }
        throw err;
      }

      if (remappedSubtreeRoot) {
        await this.remapChildFullPaths(tx, id, remappedSubtreeRoot);
      }

      return tx.location.findUniqueOrThrow({ where: { id } });
    });
  }

  private async remapChildFullPaths(
    tx: Prisma.TransactionClient,
    parentId: string,
    parentNewFullPath: string,
  ) {
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

  async softDelete(id: string) {
    const loc = await this.findById(id);
    if (loc.status === 'archived') {
      return loc;
    }
    const stockRows = await this.prisma.currentStock.count({
      where: { locationId: id },
    });
    if (stockRows > 0) {
      throw new ConflictException(
        'Cannot archive location while stock rows exist for it.',
      );
    }
    return this.prisma.location.update({
      where: { id },
      data: { status: 'archived' },
    });
  }

  /**
   * Location ids in this warehouse that still block permanent subtree delete
   * (positive on-hand or reserved, or referenced on an adjustment line).
   */
  async purgeContext(warehouseId: string) {
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

  /**
   * Permanently delete this location and all descendants (deepest children first).
   * Requires zero on-hand/reserved stock and no stock adjustment lines for every node in the subtree.
   */
  async hardDeleteSubtree(rootId: string) {
    const root = await this.prisma.location.findUnique({
      where: { id: rootId },
      select: { id: true, warehouseId: true },
    });
    if (!root) throw new NotFoundException('Location not found.');

    const flat = await this.prisma.location.findMany({
      where: { warehouseId: root.warehouseId },
      select: { id: true, parentId: true },
    });
    const childrenByParent = new Map<string, string[]>();
    for (const row of flat) {
      if (!row.parentId) continue;
      const arr = childrenByParent.get(row.parentId) ?? [];
      arr.push(row.id);
      childrenByParent.set(row.parentId, arr);
    }
    const subtree = new Set<string>();
    const walk = (id: string) => {
      subtree.add(id);
      for (const c of childrenByParent.get(id) ?? []) walk(c);
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
        throw new ConflictException(
          'Cannot delete: this location or a descendant still has on-hand or reserved stock.',
        );
      }
      const adj = await this.prisma.stockAdjustmentLine.count({ where: { locationId: id } });
      if (adj > 0) {
        throw new ConflictException(
          'Cannot delete: a location in this subtree is referenced on stock adjustment lines.',
        );
      }
    }

    const depthUnderRoot = (id: string): number => {
      let d = 0;
      let cur: string | null = id;
      while (cur !== rootId) {
        d += 1;
        cur = parentById.get(cur) ?? null;
        if (!cur) return -1;
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

  /**
   * Build a hierarchical barcode of the form
   *   {warehouseCode}-{parentSegments...}-{slug(name)}
   * preserving everything that already lived past the warehouse prefix on the
   * parent. e.g. WH-001 / aisle "A" / bin "01-02" → WH-001-A-01-02.
   */
  private buildHierarchicalBarcode(
    warehouseCode: string,
    parentBarcode: string | null,
    name: string,
  ): string {
    const slug = slugifyForBarcode(name) || 'LOC';
    if (!parentBarcode) return `${warehouseCode}-${slug}`;
    const prefix = parentBarcode.startsWith(`${warehouseCode}-`)
      ? parentBarcode
      : `${warehouseCode}-${parentBarcode}`;
    return `${prefix}-${slug}`;
  }
}
