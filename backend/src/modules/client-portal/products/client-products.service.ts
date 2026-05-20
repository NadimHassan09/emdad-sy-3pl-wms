import { ForbiddenException, Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { ClientPrincipal } from '../../../common/auth/client-principal.types';
import { AuthPrincipal } from '../../../common/auth/current-user.types';
import { NotificationsService } from '../../notifications/notifications.service';
import { ListProductsQueryDto } from '../../products/dto/list-products-query.dto';
import { ProductsService } from '../../products/products.service';
import { ClientCreateProductDto } from './dto/client-create-product.dto';

@Injectable()
export class ClientProductsService {
  constructor(
    private readonly products: ProductsService,
    private readonly notifications: NotificationsService,
  ) {}

  private principal(client: ClientPrincipal): AuthPrincipal {
    return {
      id: client.id,
      companyId: client.companyId,
      role: client.role,
      email: client.email ?? undefined,
    };
  }

  async list(client: ClientPrincipal, query: ListProductsQueryDto) {
    return this.products.list(this.principal(client), {
      ...query,
      companyId: client.companyId,
    });
  }

  async create(client: ClientPrincipal, dto: ClientCreateProductDto) {
    if (client.role === UserRole.client_staff) {
      throw new ForbiddenException('Only client administrators can create products.');
    }
    const product = await this.products.create(this.principal(client), {
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
