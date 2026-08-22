import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { Public } from '../../../common/auth/public.decorator';
import { ClientPrincipal } from '../../../common/auth/client-principal.types';
import { ParseUuidLoosePipe } from '../../../common/pipes/parse-uuid-loose.pipe';
import { ClientUser } from '../auth/client-user.decorator';
import { JwtClientAuthGuard } from '../auth/jwt-client-auth.guard';
import { ListProductsQueryDto } from '../../products/dto/list-products-query.dto';
import { ClientCreateProductDto } from './dto/client-create-product.dto';
import { ClientUpdateProductDto } from './dto/client-update-product.dto';
import { ClientProductsService } from './client-products.service';

@Public()
@UseGuards(JwtClientAuthGuard)
@Controller('client/products')
export class ClientProductsController {
  constructor(private readonly products: ClientProductsService) {}

  @Get()
  list(@ClientUser() client: ClientPrincipal, @Query() query: ListProductsQueryDto) {
    return this.products.list(client, query);
  }

  @Get(':id')
  getById(
    @ClientUser() client: ClientPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
  ) {
    return this.products.findById(client, id);
  }

  @Post()
  create(@ClientUser() client: ClientPrincipal, @Body() dto: ClientCreateProductDto) {
    return this.products.create(client, dto);
  }

  @Patch(':id')
  update(
    @ClientUser() client: ClientPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
    @Body() dto: ClientUpdateProductDto,
  ) {
    return this.products.update(client, id, dto);
  }

  @Delete(':id')
  remove(
    @ClientUser() client: ClientPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
  ) {
    return this.products.remove(client, id);
  }
}
