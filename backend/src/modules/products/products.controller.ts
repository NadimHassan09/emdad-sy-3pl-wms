import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthPrincipal } from '../../common/auth/current-user.types';
import { ParseUuidLoosePipe } from '../../common/pipes/parse-uuid-loose.pipe';
import { CreateProductDto } from './dto/create-product.dto';
import { ListProductsQueryDto } from './dto/list-products-query.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductsService } from './products.service';

@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Post()
  create(@CurrentUser() user: AuthPrincipal, @Body() dto: CreateProductDto) {
    return this.products.create(user, dto);
  }

  @Get()
  list(@CurrentUser() user: AuthPrincipal, @Query() query: ListProductsQueryDto) {
    return this.products.list(user, query);
  }

  @Get('next-sku')
  nextSku(
    @CurrentUser() user: AuthPrincipal,
    @Query('companyId') companyIdParam?: string,
  ) {
    const companyId = companyIdParam ?? user.companyId;
    if (!companyId) {
      throw new BadRequestException('companyId is required for SKU generation.');
    }
    return this.products.nextSku(companyId);
  }

  @Post(':id/suspend')
  suspend(@Param('id', ParseUuidLoosePipe) id: string) {
    return this.products.suspend(id);
  }

  @Post(':id/unsuspend')
  unsuspend(@Param('id', ParseUuidLoosePipe) id: string) {
    return this.products.unsuspend(id);
  }

  @Delete(':id/hard')
  hardDelete(@Param('id', ParseUuidLoosePipe) id: string) {
    return this.products.removePermanentlyIfSafe(id);
  }

  @Get(':id/lots')
  listLots(@Param('id', ParseUuidLoosePipe) id: string) {
    return this.products.listLotsForProduct(id);
  }

  @Patch(':id')
  update(@Param('id', ParseUuidLoosePipe) id: string, @Body() dto: UpdateProductDto) {
    return this.products.update(id, dto);
  }

  @Delete(':id')
  archive(@Param('id', ParseUuidLoosePipe) id: string) {
    return this.products.softDelete(id);
  }

  @Get(':id')
  findOne(@Param('id', ParseUuidLoosePipe) id: string) {
    return this.products.findById(id);
  }
}
