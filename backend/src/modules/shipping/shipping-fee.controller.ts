import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';

import { AuthGroup } from '../../common/auth/auth-groups';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthPrincipal } from '../../common/auth/current-user.types';
import { Roles } from '../../common/auth/roles.decorator';
import { RolesGuard } from '../../common/auth/roles.guard';
import { SuperAdminGuard } from '../../common/auth/super-admin.guard';
import {
  PreviewShippingFeeDto,
  SetShippingFeeGroupActiveDto,
  UpdateShippingFeeSettingsDto,
  UpsertShippingFeeGroupDto,
} from './dto/shipping-fee.dto';
import { ShippingFeeService } from './shipping-fee.service';

@Controller('shipping/fee-rates')
@UseGuards(RolesGuard, SuperAdminGuard)
@Roles(AuthGroup.ADMIN)
export class ShippingFeeController {
  constructor(private readonly fees: ShippingFeeService) {}

  @Get()
  getConfiguration(@Query('companyId') companyId?: string) {
    return this.fees.getConfiguration(companyId);
  }

  @Get('locations')
  listLocations(
    @Query('governorate') governorate?: string,
    @Query('cityRegion') cityRegion?: string,
  ) {
    return this.fees.listLocations(governorate, cityRegion);
  }

  @Put('settings')
  updateSettings(@Body() dto: UpdateShippingFeeSettingsDto, @CurrentUser() user: AuthPrincipal) {
    return this.fees.updateSettings(dto, user.id);
  }

  @Post('groups')
  createGroup(@Body() dto: UpsertShippingFeeGroupDto) {
    return this.fees.createGroup(dto);
  }

  @Put('groups/:id')
  updateGroup(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpsertShippingFeeGroupDto) {
    return this.fees.updateGroup(id, dto);
  }

  @Patch('groups/:id/active')
  setActive(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SetShippingFeeGroupActiveDto) {
    return this.fees.setGroupActive(id, dto);
  }

  @Post('preview')
  preview(@Body() dto: PreviewShippingFeeDto) {
    return this.fees.preview(dto);
  }
}
