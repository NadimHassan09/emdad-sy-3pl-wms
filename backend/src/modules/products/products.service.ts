import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { coerceOptionalBool } from '../../common/utils/coerce-boolean';
import { AuthPrincipal } from '../../common/auth/current-user.types';
import {
  generateBarcodeCandidate,
  generateSkuCandidate,
} from '../../common/generators/identifiers';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { ListProductsQueryDto } from './dto/list-products-query.dto';
import { UpdateProductDto } from './dto/update-product.dto';

const SKU_RETRY_LIMIT = 5;
const BARCODE_RETRY_LIMIT = 8;

const INTERNAL_ROLES = new Set<AuthPrincipal['role']>([
  'super_admin',
  'wh_manager',
  'wh_operator',
  'finance',
]);

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * RLS policies read `app.user_role` / `app.current_company_id`. Prisma does not
   * set them — without this, internal users only see rows matching the DB session
   * default tenant (e.g. first seeded company).
   */
  private async withProductCatalogRls<T>(
    user: AuthPrincipal,
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    const isInternal = INTERNAL_ROLES.has(user.role);
    const companyCtx = isInternal ? '' : user.companyId ?? '';

    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw(
        Prisma.sql`SELECT set_config('app.user_role', ${user.role}, true)`,
      );
      await tx.$executeRaw(
        Prisma.sql`SELECT set_config('app.current_company_id', ${companyCtx}, true)`,
      );
      return fn(tx);
    });
  }

  private async allocateUniqueBarcode(
    companyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<string> {
    const db = tx ?? this.prisma;
    for (let i = 0; i < BARCODE_RETRY_LIMIT; i++) {
      const candidate = generateBarcodeCandidate();
      const exists = await db.product.findFirst({
        where: { companyId, barcode: candidate },
        select: { id: true },
      });
      if (!exists) return candidate;
    }
    return generateBarcodeCandidate();
  }

  async create(user: AuthPrincipal, dto: CreateProductDto) {
    const companyId = dto.companyId;
    const clientBarcode = dto.barcode?.trim();

    let lastError: unknown;
    const attempts = dto.sku?.trim() ? 1 : SKU_RETRY_LIMIT;

    for (let attempt = 0; attempt < attempts; attempt++) {
      const sku = (dto.sku?.trim() ? dto.sku.trim() : generateSkuCandidate()).toUpperCase();
      try {
        return await this.withProductCatalogRls(user, async (tx) => {
          const barcode =
            clientBarcode || (await this.allocateUniqueBarcode(companyId, tx));
          return tx.product.create({
            data: {
              companyId,
              name: dto.name,
              sku,
              barcode,
              description: dto.description,
              trackingType: 'lot',
              uom: dto.uom ?? 'piece',
              expiryTracking: dto.expiryTracking ?? true,
              minStockThreshold: dto.minStockThreshold ?? 0,
              lengthCm:
                dto.lengthCm != null
                  ? new Prisma.Decimal(dto.lengthCm)
                  : undefined,
              widthCm:
                dto.widthCm != null
                  ? new Prisma.Decimal(dto.widthCm)
                  : undefined,
              heightCm:
                dto.heightCm != null
                  ? new Prisma.Decimal(dto.heightCm)
                  : undefined,
              weightKg:
                dto.weightKg != null
                  ? new Prisma.Decimal(dto.weightKg)
                  : undefined,
            },
            include: { company: { select: { id: true, name: true } } },
          });
        });
      } catch (err) {
        lastError = err;
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002' &&
          !dto.sku
        ) {
          continue;
        }
        throw err;
      }
    }
    throw lastError;
  }

  async list(user: AuthPrincipal, query: ListProductsQueryDto) {
    const includeArchived = coerceOptionalBool(query.includeArchived) === true;
    const where: Prisma.ProductWhereInput = {};
    if (!includeArchived) {
      where.status = { in: ['active', 'suspended'] };
    }
    // Only filter by company when explicitly requested — default is all tenants' products.
    if (query.companyId) {
      where.companyId = query.companyId;
    }

    const and: Prisma.ProductWhereInput[] = [];
    if (query.search?.trim()) {
      const q = query.search.trim();
      and.push({
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { sku: { contains: q, mode: 'insensitive' } },
          { barcode: { contains: q, mode: 'insensitive' } },
        ],
      });
    }
    if (query.productName?.trim()) {
      and.push({
        name: { contains: query.productName.trim(), mode: 'insensitive' },
      });
    }
    if (query.sku?.trim()) {
      and.push({ sku: { contains: query.sku.trim(), mode: 'insensitive' } });
    }
    if (query.productBarcode?.trim()) {
      const b = query.productBarcode.trim();
      and.push({
        AND: [
          { barcode: { not: null } },
          { barcode: { contains: b, mode: 'insensitive' } },
        ],
      });
    }
    if (and.length) where.AND = and;

    return this.withProductCatalogRls(user, async (tx) => {
      const [items, total] = await Promise.all([
        tx.product.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: query.limit,
          skip: query.offset,
          include: { company: { select: { id: true, name: true } } },
        }),
        tx.product.count({ where }),
      ]);

      const ids = items.map((p) => p.id);
      const sums =
        ids.length === 0
          ? []
          : await tx.currentStock.groupBy({
              by: ['productId'],
              where: { productId: { in: ids } },
              _sum: { quantityOnHand: true, quantityReserved: true },
            });
      const sumByProduct = new Map(
        sums.map((s) => [
          s.productId,
          {
            onHand: s._sum.quantityOnHand ?? new Prisma.Decimal(0),
            reserved: s._sum.quantityReserved ?? new Prisma.Decimal(0),
          },
        ]),
      );

      const rows = items.map((p) => {
        const agg = sumByProduct.get(p.id);
        const onHand = agg?.onHand ?? new Prisma.Decimal(0);
        const reserved = agg?.reserved ?? new Prisma.Decimal(0);
        const stockZero = onHand.equals(0) && reserved.equals(0);
        return {
          ...p,
          totalOnHand: onHand.toString(),
          totalReserved: reserved.toString(),
          /** True when UI may offer hard-delete (server re-checks FKs on delete). */
          deletable: stockZero && p.status !== 'archived',
        };
      });

      return { items: rows, total, limit: query.limit, offset: query.offset };
    });
  }

  async findById(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { company: { select: { id: true, name: true } } },
    });
    if (!product) throw new NotFoundException('Product not found.');
    return product;
  }

  async listLotsForProduct(productId: string) {
    await this.findById(productId);
    return this.prisma.lot.findMany({
      where: { productId },
      orderBy: { lotNumber: 'asc' },
      select: { id: true, lotNumber: true, expiryDate: true },
    });
  }

  async update(id: string, dto: UpdateProductDto) {
    await this.findById(id);
    const data: Prisma.ProductUpdateInput = {};
    if (dto.expiryTracking !== undefined) data.expiryTracking = dto.expiryTracking;
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.sku !== undefined) data.sku = dto.sku.trim().toUpperCase();
    if (dto.barcode !== undefined) {
      data.barcode = dto.barcode.trim() ? dto.barcode.trim() : null;
    }
    if (dto.description !== undefined) {
      data.description = dto.description?.trim()
        ? dto.description.trim()
        : null;
    }
    if (dto.uom !== undefined) data.uom = dto.uom;
    if (dto.minStockThreshold !== undefined) {
      data.minStockThreshold = dto.minStockThreshold;
    }
    if (dto.lengthCm !== undefined) {
      data.lengthCm =
        dto.lengthCm === null ? null : new Prisma.Decimal(dto.lengthCm);
    }
    if (dto.widthCm !== undefined) {
      data.widthCm =
        dto.widthCm === null ? null : new Prisma.Decimal(dto.widthCm);
    }
    if (dto.heightCm !== undefined) {
      data.heightCm =
        dto.heightCm === null ? null : new Prisma.Decimal(dto.heightCm);
    }
    if (dto.weightKg !== undefined) {
      data.weightKg =
        dto.weightKg === null ? null : new Prisma.Decimal(dto.weightKg);
    }
    if (Object.keys(data).length === 0) {
      return this.findById(id);
    }
    try {
      return await this.prisma.product.update({
        where: { id },
        data,
        include: { company: { select: { id: true, name: true } } },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException('SKU already in use for this company.');
      }
      throw err;
    }
  }

  async softDelete(id: string) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException('Product not found.');
    if (product.status === 'archived') {
      return this.findById(id);
    }

    const [stockSum, resSum, ledgerCount] = await this.prisma.$transaction([
      this.prisma.currentStock.aggregate({
        where: { productId: id },
        _sum: { quantityOnHand: true },
      }),
      this.prisma.currentStock.aggregate({
        where: { productId: id },
        _sum: { quantityReserved: true },
      }),
      this.prisma.inventoryLedger.count({ where: { productId: id } }),
    ]);
    const onHand = stockSum._sum.quantityOnHand ?? new Prisma.Decimal(0);
    const reserved = resSum._sum.quantityReserved ?? new Prisma.Decimal(0);
    if (onHand.greaterThan(0) || reserved.greaterThan(0) || ledgerCount > 0) {
      throw new ConflictException(
        'Cannot archive product while on-hand/reserved quantity or inventory history exists.',
      );
    }

    return this.prisma.product.update({
      where: { id },
      data: { status: 'archived' },
      include: { company: { select: { id: true, name: true } } },
    });
  }

  async suspend(id: string) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException('Product not found.');
    if (product.status !== 'active') {
      throw new BadRequestException('Only active products can be suspended.');
    }
    return this.prisma.product.update({
      where: { id },
      data: { status: 'suspended' },
      include: { company: { select: { id: true, name: true } } },
    });
  }

  async unsuspend(id: string) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException('Product not found.');
    if (product.status !== 'suspended') {
      throw new BadRequestException('Only suspended products can be reactivated this way.');
    }
    return this.prisma.product.update({
      where: { id },
      data: { status: 'active' },
      include: { company: { select: { id: true, name: true } } },
    });
  }

  /**
   * Permanent row removal when there is no stock and no referencing rows that
   * would violate FK constraints.
   */
  async removePermanentlyIfSafe(id: string) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException('Product not found.');
    if (product.status === 'archived') {
      throw new BadRequestException('Archived products cannot be hard-deleted from this action.');
    }

    const [onHandAgg, resAgg, inboundLines, outboundLines, adjLines, ledger] =
      await this.prisma.$transaction([
        this.prisma.currentStock.aggregate({
          where: { productId: id },
          _sum: { quantityOnHand: true },
        }),
        this.prisma.currentStock.aggregate({
          where: { productId: id },
          _sum: { quantityReserved: true },
        }),
        this.prisma.inboundOrderLine.count({ where: { productId: id } }),
        this.prisma.outboundOrderLine.count({ where: { productId: id } }),
        this.prisma.stockAdjustmentLine.count({ where: { productId: id } }),
        this.prisma.inventoryLedger.count({ where: { productId: id } }),
      ]);

    const onHand = onHandAgg._sum.quantityOnHand ?? new Prisma.Decimal(0);
    const reserved = resAgg._sum.quantityReserved ?? new Prisma.Decimal(0);
    if (onHand.greaterThan(0) || reserved.greaterThan(0)) {
      throw new ConflictException(
        'Cannot delete product while on-hand or reserved quantity is greater than zero.',
      );
    }
    if (inboundLines > 0 || outboundLines > 0 || adjLines > 0 || ledger > 0) {
      throw new ConflictException(
        'Cannot delete product that appears on orders, adjustments, or inventory history. Archive it instead.',
      );
    }

    await this.prisma.$transaction([
      this.prisma.currentStock.deleteMany({ where: { productId: id } }),
      this.prisma.lot.deleteMany({ where: { productId: id } }),
      this.prisma.product.delete({ where: { id } }),
    ]);

    return { id, deleted: true as const };
  }

  /**
   * Returns a candidate SKU that is currently free for the given company.
   * The SKU is NOT persisted — caller must POST a product to claim it.
   */
  async nextSku(companyId: string): Promise<{ sku: string }> {
    for (let i = 0; i < SKU_RETRY_LIMIT; i++) {
      const candidate = generateSkuCandidate();
      const taken = await this.prisma.product.findFirst({
        where: { companyId, sku: candidate },
        select: { id: true },
      });
      if (!taken) return { sku: candidate };
    }
    return { sku: generateSkuCandidate() };
  }
}
