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
  UseGuards,
} from '@nestjs/common';

import { InternalAdminGuard } from '../../common/auth/internal-admin.guard';
import { ParseUuidLoosePipe } from '../../common/pipes/parse-uuid-loose.pipe';
import { CreateLocationDto } from './dto/create-location.dto';
import { ListLocationsQueryDto } from './dto/list-locations-query.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { LocationsService } from './locations.service';
@Controller('locations')
export class LocationsController {
  constructor(private readonly locations: LocationsService) {}

  @Post()
  @UseGuards(InternalAdminGuard)
  create(@Body() dto: CreateLocationDto) {
    return this.locations.create(dto);
  }

  @Get()
  list(@Query() query: ListLocationsQueryDto) {
    return this.locations.list(query);
  }

  @Get('tree')
  tree(@Query('warehouseId') warehouseId?: string) {
    if (!warehouseId) {
      throw new BadRequestException('warehouseId query param is required for tree view.');
    }
    return this.locations.tree(warehouseId);
  }

  @Get('purge-context')
  @UseGuards(InternalAdminGuard)
  purgeContext(@Query('warehouseId') warehouseId?: string) {
    if (!warehouseId) {
      throw new BadRequestException('warehouseId query param is required.');
    }
    return this.locations.purgeContext(warehouseId);
  }

  @Patch(':id')
  @UseGuards(InternalAdminGuard)
  update(@Param('id', ParseUuidLoosePipe) id: string, @Body() dto: UpdateLocationDto) {
    return this.locations.update(id, dto);
  }

  @Delete(':id/permanent')
  @UseGuards(InternalAdminGuard)
  permanentRemove(@Param('id', ParseUuidLoosePipe) id: string) {
    return this.locations.hardDeleteSubtree(id);
  }

  @Delete(':id')
  @UseGuards(InternalAdminGuard)
  remove(@Param('id', ParseUuidLoosePipe) id: string) {
    return this.locations.softDelete(id);
  }

  @Get(':id')
  findOne(@Param('id', ParseUuidLoosePipe) id: string) {
    return this.locations.findById(id);
  }
}
