import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthPrincipal } from '../../common/auth/current-user.types';
import { InternalAdminGuard } from '../../common/auth/internal-admin.guard';
import { ParseUuidLoosePipe } from '../../common/pipes/parse-uuid-loose.pipe';
import { BillingCyclesService } from './billing-cycles.service';
import { BillingInvoicesService } from './billing-invoices.service';
import { BillingPlansService } from './billing-plans.service';
import { CreateBillingPlanDto } from './dto/create-billing-plan.dto';
import { CreateInvoiceLineDto } from './dto/create-invoice-line.dto';
import { UpdateBillingPlanDto } from './dto/update-billing-plan.dto';

@Controller('billing')
export class BillingController {
  constructor(
    private readonly plans: BillingPlansService,
    private readonly cycles: BillingCyclesService,
    private readonly invoices: BillingInvoicesService,
  ) {}

  @Get('capacity')
  @UseGuards(InternalAdminGuard)
  capacitySummary() {
    return this.plans.getCapacitySummary();
  }

  @Get('plans')
  listPlans(@CurrentUser() user: AuthPrincipal, @Query('companyId') companyId?: string) {
    return this.plans.list(user, companyId);
  }

  @Get('plans/:id')
  getPlan(@CurrentUser() user: AuthPrincipal, @Param('id', ParseUuidLoosePipe) id: string) {
    return this.plans.findById(user, id);
  }

  @Post('plans')
  @UseGuards(InternalAdminGuard)
  createPlan(@CurrentUser() user: AuthPrincipal, @Body() dto: CreateBillingPlanDto) {
    return this.plans.create(user, dto);
  }

  @Patch('plans/:id')
  @UseGuards(InternalAdminGuard)
  updatePlan(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
    @Body() dto: UpdateBillingPlanDto,
  ) {
    return this.plans.update(user, id, dto);
  }

  @Get('cycles')
  listCycles(@CurrentUser() user: AuthPrincipal, @Query('companyId') companyId?: string) {
    return this.cycles.list(user, companyId);
  }

  @Get('cycles/expiring-soon')
  listExpiringSoon(
    @CurrentUser() user: AuthPrincipal,
    @Query('limit') limit?: string,
  ) {
    const n = limit ? Number.parseInt(limit, 10) : 5;
    return this.cycles.listExpiringSoon(user, Number.isFinite(n) ? n : 5);
  }

  @Get('cycles/:id')
  getCycle(@CurrentUser() user: AuthPrincipal, @Param('id', ParseUuidLoosePipe) id: string) {
    return this.cycles.findById(user, id);
  }

  @Post('cycles/:id/renew')
  @UseGuards(InternalAdminGuard)
  renewCycle(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
  ) {
    return this.cycles.renew(user, id);
  }

  @Get('invoices')
  listInvoices(@CurrentUser() user: AuthPrincipal, @Query('companyId') companyId?: string) {
    return this.invoices.list(user, companyId);
  }

  @Get('invoices/:id')
  getInvoice(@CurrentUser() user: AuthPrincipal, @Param('id', ParseUuidLoosePipe) id: string) {
    return this.invoices.findById(user, id);
  }

  @Post('invoices/:id/lines')
  @UseGuards(InternalAdminGuard)
  addInvoiceLine(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
    @Body() dto: CreateInvoiceLineDto,
  ) {
    return this.invoices.addLine(user, id, dto);
  }
}
