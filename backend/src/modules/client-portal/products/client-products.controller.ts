import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';

import { Public } from '../../../common/auth/public.decorator';
import { ClientPrincipal } from '../../../common/auth/client-principal.types';
import { ClientUser } from '../auth/client-user.decorator';
import { JwtClientAuthGuard } from '../auth/jwt-client-auth.guard';
import { ListProductsQueryDto } from '../../products/dto/list-products-query.dto';
import { ClientCreateProductDto } from './dto/client-create-product.dto';
import { ClientProductsService } from './client-products.service';

@Controller('client/products')
export class ClientProductsController {
  constructor(private readonly products: ClientProductsService) {}

  @Public()
  @Get()
  @UseGuards(JwtClientAuthGuard)
  list(@ClientUser() client: ClientPrincipal, @Query() query: ListProductsQueryDto) {
    return this.products.list(client, query);
  }

  @Public()
  @Post()
  @UseGuards(JwtClientAuthGuard)
  create(@ClientUser() client: ClientPrincipal, @Body() dto: ClientCreateProductDto) {
    return this.products.create(client, dto);
  }
}

