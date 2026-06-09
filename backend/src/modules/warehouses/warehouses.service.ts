import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Warehouse, WarehouseStatus } from '@prisma/client';

import { AuditLogService } from '../../common/audit/audit-log.service';
import { AuthPrincipal } from '../../common/auth/current-user.types';
import { coerceOptionalBool } from '../../common/utils/coerce-boolean';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { warehouseRealtimePayload } from '../realtime/realtime-master-data.payload';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { ListWarehousesQueryDto } from './dto/list-warehouses-query.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';

const WAREHOUSE_CODE_LOCK_KEY = 0x57484344; // 'WHCD'

function warehouseAuditSnapshot(wh: Warehouse) {
  return {
    id: wh.id,
    code: wh.code,
    name: wh.name,
    address: wh.address,
    city: wh.city,
    country: wh.country,
    status: wh.status,
  };
}

@Injectable()
export class WarehousesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
    private readonly audit: AuditLogService,
  ) {}

  /**
   * Create a warehouse, auto-generating a `WH-NNN` code when one isn't
   * supplied. The advisory lock + computation + insert all run inside a
   * single transaction so concurrent callers can't pick the same code.
   */
  async create(user: AuthPrincipal, dto: CreateWarehouseDto) {
    const created = await this.prisma.$transaction(async (tx) => {
      let code = dto.code?.trim();

      if (!code) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${WAREHOUSE_CODE_LOCK_KEY})`;
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
    await this.audit.log(
      this.audit.fromPrincipal(user, {
        action: 'WAREHOUSE_CREATED',
        resourceType: 'warehouse',
        resourceId: created.id,
        newState: warehouseAuditSnapshot(created),
      }),
    );
    this.realtime.emitWarehouseCreated(warehouseRealtimePayload(created));
    return created;
  }

  list(query?: ListWarehousesQueryDto) {
    const includeInactive = coerceOptionalBool(query?.includeInactive) === true;
    const where: Prisma.WarehouseWhereInput = {};
    if (!includeInactive) {
      where.status = 'active';
    }
    return this.prisma.warehouse.findMany({ where, orderBy: { code: 'asc' } });
  }

  async findById(id: string) {
    const wh = await this.prisma.warehouse.findUnique({ where: { id } });
    if (!wh) throw new NotFoundException('Warehouse not found.');
    return wh;
  }

  /**
   * Returns the next available `WH-NNN` code without persisting anything.
   * Used by the "Generate Code" button on the frontend.
   */
  async nextCode(): Promise<{ code: string }> {
    const code = await this.computeNextCode(this.prisma);
    return { code };
  }

  async setStatus(user: AuthPrincipal, id: string, status: WarehouseStatus) {
    const before = await this.findById(id);
    const updated = await this.prisma.warehouse.update({ where: { id }, data: { status } });
    await this.audit.log(
      this.audit.fromPrincipal(user, {
        action: 'WAREHOUSE_STATUS_CHANGED',
        resourceType: 'warehouse',
        resourceId: id,
        previousState: warehouseAuditSnapshot(before),
        newState: warehouseAuditSnapshot(updated),
      }),
    );
    this.realtime.emitWarehouseUpdated(warehouseRealtimePayload(updated));
    return updated;
  }

  async update(user: AuthPrincipal, id: string, dto: UpdateWarehouseDto) {
    const before = await this.findById(id);
    const data: Prisma.WarehouseUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.address !== undefined) data.address = dto.address;
    if (dto.city !== undefined) data.city = dto.city;
    if (dto.country !== undefined) data.country = dto.country;
    if (Object.keys(data).length === 0) {
      return before;
    }
    const updated = await this.prisma.warehouse.update({ where: { id }, data });
    await this.audit.log(
      this.audit.fromPrincipal(user, {
        action: 'WAREHOUSE_UPDATED',
        resourceType: 'warehouse',
        resourceId: id,
        previousState: warehouseAuditSnapshot(before),
        newState: warehouseAuditSnapshot(updated),
      }),
    );
    this.realtime.emitWarehouseUpdated(warehouseRealtimePayload(updated));
    return updated;
  }

  async softDelete(user: AuthPrincipal, id: string) {
    const before = await this.findById(id);
    const activeLocs = await this.prisma.location.count({
      where: {
        warehouseId: id,
        status: { not: 'archived' },
      },
    });
    if (activeLocs > 0) {
      throw new ConflictException(
        'Cannot deactivate warehouse while non-archived locations exist.',
      );
    }
    const updated = await this.prisma.warehouse.update({
      where: { id },
      data: { status: 'inactive' },
    });
    await this.audit.log(
      this.audit.fromPrincipal(user, {
        action: 'WAREHOUSE_DEACTIVATED',
        resourceType: 'warehouse',
        resourceId: id,
        previousState: warehouseAuditSnapshot(before),
        newState: warehouseAuditSnapshot(updated),
      }),
    );
    this.realtime.emitWarehouseUpdated(warehouseRealtimePayload(updated));
    return updated;
  }

  private async computeNextCode(
    client: Prisma.TransactionClient | PrismaService,
  ): Promise<string> {
    const rows = await client.$queryRaw<Array<{ max_n: number | null }>>`
      SELECT MAX(NULLIF(regexp_replace(code, '^WH-', ''), '')::int) AS max_n
        FROM warehouses
       WHERE code ~ '^WH-[0-9]+$'
    `;
    const next = (rows[0]?.max_n ?? 0) + 1;
    return `WH-${String(next).padStart(3, '0')}`;
  }
}
