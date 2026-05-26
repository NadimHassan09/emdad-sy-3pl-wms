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

import { AuthGroup } from '../../common/auth/auth-groups';
import { ParseUuidLoosePipe } from '../../common/pipes/parse-uuid-loose.pipe';
import { Roles } from '../../common/auth/roles.decorator';
import { RolesGuard } from '../../common/auth/roles.guard';
import { CreateLocationDto } from './dto/create-location.dto';
import { ListLocationsQueryDto } from './dto/list-locations-query.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { LocationsService } from './locations.service';
@Controller('locations')
export class LocationsController {
  constructor(private readonly locations: LocationsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(AuthGroup.ADMIN)
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
  @UseGuards(RolesGuard)
  @Roles(AuthGroup.ADMIN)
  purgeContext(@Query('warehouseId') warehouseId?: string) {
    if (!warehouseId) {
      throw new BadRequestException('warehouseId query param is required.');
    }
    return this.locations.purgeContext(warehouseId);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(AuthGroup.ADMIN)
  update(@Param('id', ParseUuidLoosePipe) id: string, @Body() dto: UpdateLocationDto) {
    return this.locations.update(id, dto);
  }

  @Delete(':id/permanent')
  @UseGuards(RolesGuard)
  @Roles(AuthGroup.ADMIN)
  permanentRemove(@Param('id', ParseUuidLoosePipe) id: string) {
    return this.locations.hardDeleteSubtree(id);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(AuthGroup.ADMIN)
  remove(@Param('id', ParseUuidLoosePipe) id: string) {
    return this.locations.softDelete(id);
  }

  @Get(':id')
  findOne(@Param('id', ParseUuidLoosePipe) id: string) {
    return this.locations.findById(id);
  }
}
