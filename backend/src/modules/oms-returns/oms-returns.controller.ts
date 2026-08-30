import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';

import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthPrincipal } from '../../common/auth/current-user.types';
import { ParseUuidLoosePipe } from '../../common/pipes/parse-uuid-loose.pipe';
import {
  ApproveOmsReturnDto,
  CreateOmsReturnDto,
  ImportOmsReturnsDto,
  PreviewOmsReturnDto,
  RejectOmsReturnDto,
  UpdateOmsReturnPlanDto,
} from './dto/oms-return.dto';
import {
  ListOmsReturnsQueryDto,
  OmsReturnsService,
} from './oms-returns.service';

@Controller('oms/returns')
export class OmsReturnsController {
  constructor(private readonly returns: OmsReturnsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthPrincipal,
    @Query() query: ListOmsReturnsQueryDto,
  ) {
    return this.returns.list(user, query);
  }

  @Post()
  create(
    @CurrentUser() user: AuthPrincipal,
    @Body() dto: CreateOmsReturnDto,
  ) {
    return this.returns.create(user, dto);
  }

  @Post('express')
  expressReturn(
    @CurrentUser() user: AuthPrincipal,
    @Body() body: { omsOrderIds: string[]; reason?: string },
  ) {
    return this.returns.expressReturn(user, body);
  }

  @Post('express/validate')
  validateExpressReturn(
    @CurrentUser() user: AuthPrincipal,
    @Body() body: { omsOrderIds: string[] },
  ) {
    return this.returns.validateOrdersForExpressReturn(user, body);
  }

  /** Normal Return only — resolve order + returnable lines. */
  @Post('preview')
  preview(
    @CurrentUser() user: AuthPrincipal,
    @Body() dto: PreviewOmsReturnDto,
  ) {
    return this.returns.previewNormalReturn(user, dto);
  }

  /** Normal Return CSV — validate only (no create); review then Confirm in UI. */
  @Post('import/validate')
  validateImportRows(
    @CurrentUser() user: AuthPrincipal,
    @Body() dto: ImportOmsReturnsDto,
  ) {
    return this.returns.validateNormalReturnImport(user, dto);
  }

  /** Normal Return CSV — create after validate (prefer UI Confirm + POST /oms/returns). */
  @Post('import')
  importRows(
    @CurrentUser() user: AuthPrincipal,
    @Body() dto: ImportOmsReturnsDto,
  ) {
    return this.returns.importNormalReturns(user, dto);
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
  ) {
    return this.returns.findById(id, user);
  }

  @Patch(':id/plan')
  updatePlan(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
    @Body() dto: UpdateOmsReturnPlanDto,
  ) {
    return this.returns.updatePlan(id, user, dto);
  }

  @Post(':id/approve')
  approve(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
    @Body() dto: ApproveOmsReturnDto,
  ) {
    return this.returns.approve(id, user, dto);
  }

  @Post(':id/complete-receiving')
  completeReceiving(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
  ) {
    return this.returns.completeReceivingAdmin(id, user);
  }

  @Post(':id/complete-putaway')
  completePutaway(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
  ) {
    return this.returns.completePutawayAdmin(id, user);
  }

  @Post(':id/reject')
  reject(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
    @Body() dto: RejectOmsReturnDto,
  ) {
    return this.returns.reject(id, user, dto);
  }
}
