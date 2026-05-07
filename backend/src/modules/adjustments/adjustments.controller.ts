import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthPrincipal } from '../../common/auth/current-user.types';
import { ParseUuidLoosePipe } from '../../common/pipes/parse-uuid-loose.pipe';
import { AdjustmentsService } from './adjustments.service';
import { AddAdjustmentLineDto } from './dto/add-adjustment-line.dto';
import { CreateAdjustmentDto } from './dto/create-adjustment.dto';
import { ListAdjustmentsQueryDto } from './dto/list-adjustments-query.dto';
import { PatchAdjustmentDto } from './dto/patch-adjustment.dto';
import { PatchAdjustmentLineDto } from './dto/patch-adjustment-line.dto';

@Controller('adjustments')
export class AdjustmentsController {
  constructor(private readonly adjustments: AdjustmentsService) {}

  @Post()
  create(@CurrentUser() user: AuthPrincipal, @Body() dto: CreateAdjustmentDto) {
    return this.adjustments.create(user, dto);
  }

  @Get()
  list(@CurrentUser() user: AuthPrincipal, @Query() query: ListAdjustmentsQueryDto) {
    return this.adjustments.list(user, query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUuidLoosePipe) id: string) {
    return this.adjustments.findById(id);
  }

  @Patch(':id')
  patch(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
    @Body() dto: PatchAdjustmentDto,
  ) {
    return this.adjustments.patch(user, id, dto);
  }

  @Post(':id/lines')
  addLine(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
    @Body() dto: AddAdjustmentLineDto,
  ) {
    return this.adjustments.addLine(user, id, dto);
  }

  @Patch(':id/lines/:lineId')
  patchLine(
    @Param('id', ParseUuidLoosePipe) id: string,
    @Param('lineId', ParseUuidLoosePipe) lineId: string,
    @Body() dto: PatchAdjustmentLineDto,
  ) {
    return this.adjustments.patchLine(id, lineId, dto);
  }

  @Post(':id/approve')
  approve(@CurrentUser() user: AuthPrincipal, @Param('id', ParseUuidLoosePipe) id: string) {
    return this.adjustments.approve(user, id);
  }

  @Post(':id/cancel')
  cancel(@Param('id', ParseUuidLoosePipe) id: string) {
    return this.adjustments.cancel(id);
  }
}
