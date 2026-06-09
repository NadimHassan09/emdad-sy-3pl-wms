import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthPrincipal } from '../../common/auth/current-user.types';
import { InternalAdminGuard } from '../../common/auth/internal-admin.guard';
import { ParseUuidLoosePipe } from '../../common/pipes/parse-uuid-loose.pipe';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { ListWarehousesQueryDto } from './dto/list-warehouses-query.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';
import { UpdateWarehouseStatusDto } from './dto/update-warehouse-status.dto';
import { WarehousesService } from './warehouses.service';

@Controller('warehouses')
export class WarehousesController {
  constructor(private readonly warehouses: WarehousesService) {}

  @Post()
  @UseGuards(InternalAdminGuard)
  create(@CurrentUser() user: AuthPrincipal, @Body() dto: CreateWarehouseDto) {
    return this.warehouses.create(user, dto);
  }

  @Get()
  list(@Query() query: ListWarehousesQueryDto) {
    return this.warehouses.list(query);
  }

  @Get('next-code')
  nextCode() {
    return this.warehouses.nextCode();
  }

  @Patch(':id')
  @UseGuards(InternalAdminGuard)
  update(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
    @Body() dto: UpdateWarehouseDto,
  ) {
    return this.warehouses.update(user, id, dto);
  }

  @Delete(':id')
  @UseGuards(InternalAdminGuard)
  remove(@CurrentUser() user: AuthPrincipal, @Param('id', ParseUuidLoosePipe) id: string) {
    return this.warehouses.softDelete(user, id);
  }

  @Get(':id')
  findOne(@Param('id', ParseUuidLoosePipe) id: string) {
    return this.warehouses.findById(id);
  }

  @Patch(':id/status')
  @UseGuards(InternalAdminGuard)
  setStatus(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
    @Body() dto: UpdateWarehouseStatusDto,
  ) {
    return this.warehouses.setStatus(user, id, dto.status);
  }
}
