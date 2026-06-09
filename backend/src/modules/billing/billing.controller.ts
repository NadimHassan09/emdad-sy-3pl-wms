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
import { BillingDashboardService } from './billing-dashboard.service';
import { BillingInvoicesService } from './billing-invoices.service';
import { BillingPlansService } from './billing-plans.service';
import { BillingPreviewService } from './billing-preview.service';
import { UpdateInvoiceStatusDto } from './dto/update-invoice-status.dto';
import { CreateBillingPlanDto } from './dto/create-billing-plan.dto';
import { CreateInvoiceLineDto } from './dto/create-invoice-line.dto';
import { ListBillingInvoicesQueryDto } from './dto/list-billing-invoices-query.dto';
import { ListBillingPlansQueryDto } from './dto/list-billing-plans-query.dto';
import { UpdateBillingPlanDto } from './dto/update-billing-plan.dto';

@Controller('billing')
export class BillingController {
  constructor(
    private readonly plans: BillingPlansService,
    private readonly cycles: BillingCyclesService,
    private readonly invoices: BillingInvoicesService,
    private readonly dashboard: BillingDashboardService,
    private readonly preview: BillingPreviewService,
  ) {}

  @Get('capacity')
  @UseGuards(InternalAdminGuard)
  capacitySummary() {
    return this.plans.getCapacitySummary();
  }

  @Get('plans')
  listPlans(@CurrentUser() user: AuthPrincipal, @Query() query: ListBillingPlansQueryDto) {
    return this.plans.listPage(user, query);
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
  listInvoices(@CurrentUser() user: AuthPrincipal, @Query() query: ListBillingInvoicesQueryDto) {
    return this.invoices.listPage(user, query);
  }

  @Get('dashboard/summary')
  dashboardSummary(@CurrentUser() user: AuthPrincipal) {
    return this.dashboard.getSummary(user);
  }

  @Get('dashboard/expiring-buckets')
  expiringBuckets(@CurrentUser() user: AuthPrincipal) {
    return this.dashboard.listExpiringBuckets(user);
  }

  @Get('preview')
  cyclePreview(
    @CurrentUser() user: AuthPrincipal,
    @Query('companyId') companyId: string,
  ) {
    return this.preview.getCompanyPreview(user, companyId);
  }

  @Get('dashboard/overdue-clients')
  listOverdueClients(
    @CurrentUser() user: AuthPrincipal,
    @Query('limit') limit?: string,
  ) {
    const n = limit ? Number.parseInt(limit, 10) : 5;
    return this.dashboard.listOverdueClients(user, Number.isFinite(n) ? n : 5);
  }

  @Get('dashboard/recent-invoices')
  listRecentInvoices(
    @CurrentUser() user: AuthPrincipal,
    @Query('limit') limit?: string,
  ) {
    const n = limit ? Number.parseInt(limit, 10) : 5;
    return this.dashboard.listRecentInvoices(user, Number.isFinite(n) ? n : 5);
  }

  @Get('dashboard/suspended-accounts')
  listSuspendedAccounts(
    @CurrentUser() user: AuthPrincipal,
    @Query('limit') limit?: string,
  ) {
    const n = limit ? Number.parseInt(limit, 10) : 5;
    return this.dashboard.listSuspendedAccounts(user, Number.isFinite(n) ? n : 5);
  }

  @Get('invoices/:id')
  getInvoice(@CurrentUser() user: AuthPrincipal, @Param('id', ParseUuidLoosePipe) id: string) {
    return this.invoices.findById(user, id);
  }

  @Patch('invoices/:id/status')
  @UseGuards(InternalAdminGuard)
  updateInvoiceStatus(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
    @Body() dto: UpdateInvoiceStatusDto,
  ) {
    return this.invoices.updateStatus(user, id, dto.status);
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
