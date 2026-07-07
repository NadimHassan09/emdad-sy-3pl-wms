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

    const agg = await this.prisma.currentStock.aggregate({
      where: { companyId: client.companyId, productId: id },
      _sum: { quantityOnHand: true, quantityReserved: true },
    });
    const onHand = agg._sum.quantityOnHand ?? new Prisma.Decimal(0);
    const reserved = agg._sum.quantityReserved ?? new Prisma.Decimal(0);

    const avail = await this.inventory.availability(principal, id, client.companyId);

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
      lengthCm: product.lengthCm?.toString() ?? null,
      widthCm: product.widthCm?.toString() ?? null,
      heightCm: product.heightCm?.toString() ?? null,
      weightKg: product.weightKg?.toString() ?? null,
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
      totalOnHand: onHand.toString(),
      totalReserved: reserved.toString(),
      totalAvailable: avail.available,
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
