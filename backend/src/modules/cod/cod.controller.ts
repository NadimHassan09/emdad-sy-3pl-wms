import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CodRecordStatus } from '@prisma/client';

import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthPrincipal } from '../../common/auth/current-user.types';
import { ParseUuidLoosePipe } from '../../common/pipes/parse-uuid-loose.pipe';
import { CodRecordsService } from './cod-records.service';
import {
  CreateCodAdjustmentDto,
  ListCodRecordsQueryDto,
  UpdateCodStatusDto,
} from './dto/cod.dto';

@Controller('cod')
export class CodController {
  constructor(private readonly cod: CodRecordsService) {}

  @Get('records')
  list(@CurrentUser() user: AuthPrincipal, @Query() query: ListCodRecordsQueryDto) {
    return this.cod.list(user, query);
  }

  @Get('records/:id')
  findOne(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
  ) {
    return this.cod.findById(id, user);
  }

  @Get('by-order/:omsOrderId')
  byOrder(
    @CurrentUser() user: AuthPrincipal,
    @Param('omsOrderId', ParseUuidLoosePipe) omsOrderId: string,
  ) {
    return this.cod.findByOmsOrder(omsOrderId, user);
  }

  @Post('orders/:omsOrderId/retry')
  retry(
    @CurrentUser() user: AuthPrincipal,
    @Param('omsOrderId', ParseUuidLoosePipe) omsOrderId: string,
  ) {
    return this.cod.retryGeneration(omsOrderId, user);
  }

  @Patch('records/:id/status')
  setStatus(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
    @Body() dto: UpdateCodStatusDto,
  ) {
    return this.cod.setStatus(id, user, dto.status as CodRecordStatus);
  }

  @Post('records/:id/adjustments')
  adjust(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
    @Body() dto: CreateCodAdjustmentDto,
  ) {
    return this.cod.addManualAdjustment(id, user, dto);
  }
}
