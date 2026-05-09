import { Injectable } from '@nestjs/common';

import { ClientPrincipal } from '../../../common/auth/client-principal.types';
import { AuthPrincipal } from '../../../common/auth/current-user.types';
import { ListProductsQueryDto } from '../../products/dto/list-products-query.dto';
import { ProductsService } from '../../products/products.service';

@Injectable()
export class ClientProductsService {
  constructor(private readonly products: ProductsService) {}

  async list(client: ClientPrincipal, query: ListProductsQueryDto) {
    const principal: AuthPrincipal = {
      id: client.id,
      companyId: client.companyId,
      role: client.role,
      email: client.email ?? undefined,
    };
    return this.products.list(principal, {
      ...query,
      companyId: client.companyId,
    });
  }
}
