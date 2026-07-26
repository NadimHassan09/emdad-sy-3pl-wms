import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';

import { clientAuthPrincipal } from '../../../common/auth/client-auth-principal';
import { ClientPrincipal } from '../../../common/auth/client-principal.types';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { InventoryService } from '../../inventory/inventory.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { ListProductsQueryDto } from '../../products/dto/list-products-query.dto';
import { ProductsService } from '../../products/products.service';
import { ClientCreateProductDto } from './dto/client-create-product.dto';

@Injectable()
export class ClientProductsService {
  constructor(
    private readonly products: ProductsService,
    private readonly notifications: NotificationsService,
    private readonly inventory: InventoryService,
    private readonly prisma: PrismaService,
  ) {}

  async list(client: ClientPrincipal, query: ListProductsQueryDto) {
    return this.products.list(clientAuthPrincipal(client), {
      ...query,
      companyId: client.companyId,
    });
  }

  async findById(client: ClientPrincipal, id: string) {
    const principal = clientAuthPrincipal(client);
    const product = await this.products.findById(id, principal);

    const [agg, avail, inboundAgg, outboundAgg, earliestExpiry] = await Promise.all([
      this.prisma.currentStock.aggregate({
        where: { companyId: client.companyId, productId: id },
        _sum: { quantityOnHand: true, quantityReserved: true },
      }),
      this.inventory.availability(principal, id, client.companyId),
      this.prisma.inboundOrderLine.aggregate({
        where: { productId: id, order: { companyId: client.companyId } },
        _sum: { receivedQuantity: true },
      }),
      this.prisma.outboundOrderLine.aggregate({
        where: { productId: id, order: { companyId: client.companyId } },
        _sum: { pickedQuantity: true },
      }),
      this.prisma.currentStock.findFirst({
        where: {
          companyId: client.companyId,
          productId: id,
          quantityOnHand: { gt: 0 },
          lotId: { not: null },
          lot: { expiryDate: { not: null } },
        },
        orderBy: { lot: { expiryDate: 'asc' } },
        select: { lot: { select: { expiryDate: true } } },
      }),
    ]);

    const onHand = agg._sum.quantityOnHand ?? new Prisma.Decimal(0);
    const reserved = agg._sum.quantityReserved ?? new Prisma.Decimal(0);
    const volumeCbm =
      product.volumeCbm ??
      (product.lengthCm != null && product.widthCm != null && product.heightCm != null
        ? new Prisma.Decimal(product.lengthCm)
            .mul(product.widthCm)
            .mul(product.heightCm)
            .div(1_000_000)
            .toDecimalPlaces(6)
        : null);

    return {
      id: product.id,
      name: product.name,
      sku: product.sku,
      barcode: product.barcode,
      description: product.description,
      uom: product.uom,
      status: product.status,
      expiryTracking: product.expiryTracking,
      minStockThreshold: product.minStockThreshold?.toString() ?? '0',
      category: null as string | null,
      categoryId: product.categoryId ?? null,
      lengthCm: product.lengthCm?.toString() ?? null,
      widthCm: product.widthCm?.toString() ?? null,
      heightCm: product.heightCm?.toString() ?? null,
      weightKg: product.weightKg?.toString() ?? null,
      volumeCbm: volumeCbm?.toString() ?? null,
      /** Warehouse issuance method: FEFO when expiry tracking is on, otherwise FIFO. */
      inventoryMethod: product.expiryTracking ? ('FEFO' as const) : ('FIFO' as const),
      createdBy: null as string | null,
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
      totalOnHand: onHand.toString(),
      totalReserved: reserved.toString(),
      totalAvailable: avail.available,
      totalInboundQuantity: (inboundAgg._sum.receivedQuantity ?? new Prisma.Decimal(0)).toString(),
      totalOutboundQuantity: (outboundAgg._sum.pickedQuantity ?? new Prisma.Decimal(0)).toString(),
      earliestExpiryDate: earliestExpiry?.lot?.expiryDate
        ? earliestExpiry.lot.expiryDate.toISOString().slice(0, 10)
        : null,
    };
  }

  async create(client: ClientPrincipal, dto: ClientCreateProductDto) {
    if (client.role === UserRole.client_staff) {
      throw new ForbiddenException('Only client administrators can create products.');
    }
    const product = await this.products.create(clientAuthPrincipal(client), {
      ...dto,
      companyId: client.companyId,
    });

    try {
      await this.notifications.notifyAdminsClientProductAdded({
        companyId: client.companyId,
        companyName: product.company?.name ?? 'Client',
        productId: product.id,
        productSku: product.sku,
        productName: product.name,
      });
    } catch {
      // Product is already persisted; do not fail the client request if notify fails.
    }

    return product;
  }
}
