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

import { AuthGroup } from '../../common/auth/auth-groups';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthPrincipal } from '../../common/auth/current-user.types';
import { Roles } from '../../common/auth/roles.decorator';
import { RolesGuard } from '../../common/auth/roles.guard';
import { ParseUuidLoosePipe } from '../../common/pipes/parse-uuid-loose.pipe';
import { CreateProductDto } from './dto/create-product.dto';
import { ListProductsQueryDto } from './dto/list-products-query.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductsService } from './products.service';

@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(AuthGroup.ADMIN)
  create(@CurrentUser() user: AuthPrincipal, @Body() dto: CreateProductDto) {
    return this.products.create(user, dto);
  }

  @Get()
  list(@CurrentUser() user: AuthPrincipal, @Query() query: ListProductsQueryDto) {
    return this.products.list(user, query);
  }

  @Get('next-sku')
  @UseGuards(RolesGuard)
  @Roles(AuthGroup.ADMIN)
  nextSku(
    @CurrentUser() user: AuthPrincipal,
    @Query('companyId') companyIdParam?: string,
  ) {
    return this.products.nextSku(user, companyIdParam);
  }

  @Post(':id/suspend')
  @UseGuards(RolesGuard)
  @Roles(AuthGroup.ADMIN)
  suspend(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
  ) {
    return this.products.suspend(id, user);
  }

  @Post(':id/unsuspend')
  @UseGuards(RolesGuard)
  @Roles(AuthGroup.ADMIN)
  unsuspend(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
  ) {
    return this.products.unsuspend(id, user);
  }

  @Delete(':id/hard')
  @UseGuards(RolesGuard)
  @Roles(AuthGroup.ADMIN)
  hardDelete(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
  ) {
    return this.products.removePermanentlyIfSafe(id, user);
  }

  @Get(':id/lots')
  listLots(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
  ) {
    return this.products.listLotsForProduct(id, user);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(AuthGroup.ADMIN)
  update(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.products.update(id, dto, user);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(AuthGroup.ADMIN)
  archive(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
  ) {
    return this.products.softDelete(id, user);
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
  ) {
    return this.products.findById(id, user);
  }
}
