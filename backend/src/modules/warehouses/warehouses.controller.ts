import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';

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
  create(@Body() dto: CreateWarehouseDto) {
    return this.warehouses.create(dto);
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
  update(@Param('id', ParseUuidLoosePipe) id: string, @Body() dto: UpdateWarehouseDto) {
    return this.warehouses.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(InternalAdminGuard)
  remove(@Param('id', ParseUuidLoosePipe) id: string) {
    return this.warehouses.softDelete(id);
  }

  @Get(':id')
  findOne(@Param('id', ParseUuidLoosePipe) id: string) {
    return this.warehouses.findById(id);
  }

  @Patch(':id/status')
  @UseGuards(InternalAdminGuard)
  setStatus(
    @Param('id', ParseUuidLoosePipe) id: string,
    @Body() dto: UpdateWarehouseStatusDto,
  ) {
    return this.warehouses.setStatus(id, dto.status);
  }
}
