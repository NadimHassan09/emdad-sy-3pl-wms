import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  BillingDiscountType,
  BillingInvoiceLineSource,
  BillingInvoiceLineType,
  BillingInvoiceSource,
  BillingInvoiceStatus,
  Prisma,
} from '@prisma/client';

import { AuthPrincipal } from '../../common/auth/current-user.types';
import { CompanyAccessService } from '../../common/company-access/company-access.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { BillingAuditService, BILLING_AUDIT_ACTIONS } from './billing-audit.service';
import { BillingInvoiceCalculationService } from './billing-invoice-calculation.service';
import { CreateInvoiceLineDto } from './dto/create-invoice-line.dto';
import {
  CreateAdHocInvoiceDto,
  CreateManualInvoiceLineDto,
  UpdateInvoiceDto,
  UpdateManualInvoiceLineDto,
} from './dto/invoice-mutations.dto';
import { ListBillingInvoicesQueryDto } from './dto/list-billing-invoices-query.dto';

export const INVOICE_SELECT = {
  id: true,
  companyId: true,
  billingCycleId: true,
  invoiceSource: true,
  invoiceNumber: true,
  status: true,
  subtotalAmount: true,
  discountType: true,
  discountValue: true,
  discountAmount: true,
  vatPercentage: true,
  vatAmount: true,
  grandTotal: true,
  totalAmount: true,
  issuedAt: true,
  dueDate: true,
  createdAt: true,
  updatedAt: true,
  billingCycle: {
    select: {
      id: true,
      startsAt: true,
      endsAt: true,
      status: true,
      rateSnapshot: true,
      billingPlanId: true,
    },
  },
  lines: {
    select: {
      id: true,
      type: true,
      lineSource: true,
      description: true,
      quantity: true,
      unitPrice: true,
      totalPrice: true,
      orderChargeId: true,
      createdAt: true,
    },
    orderBy: [{ lineSource: 'asc' as const }, { createdAt: 'asc' as const }],
  },
} satisfies Prisma.InvoiceSelect;

@Injectable()
export class BillingInvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyAccess: CompanyAccessService,
    private readonly billingAudit: BillingAuditService,
    private readonly invoiceCalc: BillingInvoiceCalculationService,
    private readonly realtime: RealtimeService,
  ) {}

  private emitInvoice(
    invoice: { id: string; companyId: string; status: string; invoiceNumber?: string | null },
    action: string,
  ): void {
    this.realtime.emitInvoiceUpdated(invoice.companyId, {
      invoiceId: invoice.id,
      companyId: invoice.companyId,
      status: invoice.status,
      invoiceNumber: invoice.invoiceNumber ?? null,
      action,
    });
  }

  async updateStatus(
    user: AuthPrincipal,
    id: string,
    status: 'paid' | 'cancelled' | 'unpaid',
  ) {
    const invoice = await this.findById(user, id);
    const allowed: Record<string, BillingInvoiceStatus[]> = {
      paid: [BillingInvoiceStatus.unpaid, BillingInvoiceStatus.open, BillingInvoiceStatus.overdue],
      cancelled: [
        BillingInvoiceStatus.draft,
        BillingInvoiceStatus.unpaid,
        BillingInvoiceStatus.open,
        BillingInvoiceStatus.overdue,
      ],
      unpaid: [BillingInvoiceStatus.paid, BillingInvoiceStatus.cancelled],
    };
    const from = invoice.status as BillingInvoiceStatus;
    if (!allowed[status]?.includes(from)) {
      throw new BadRequestException(
        `Cannot transition invoice from ${from} to ${status}.`,
      );
    }

    const data: Prisma.InvoiceUpdateInput = { status: status as BillingInvoiceStatus };
    if (status === 'unpaid' && !invoice.issuedAt) {
      data.issuedAt = new Date();
    }

    const updated = await this.prisma.invoice.update({
      where: { id },
      data,
      select: INVOICE_SELECT,
    });

    const action =
      status === 'paid'
        ? BILLING_AUDIT_ACTIONS.INVOICE_PAID
        : status === 'cancelled'
          ? BILLING_AUDIT_ACTIONS.INVOICE_CANCELLED
          : BILLING_AUDIT_ACTIONS.INVOICE_GENERATED;

    void this.billingAudit.fromUser(user, {
      action,
      resourceType: 'invoice',
      resourceId: id,
      companyId: invoice.companyId,
      previousState: { status: from },
      newState: { status },
    });

    this.emitInvoice(updated, action);
    return updated;
  }

  async issueInvoice(user: AuthPrincipal, id: string) {
    const invoice = await this.findById(user, id);
    if (invoice.status !== BillingInvoiceStatus.draft) {
      throw new BadRequestException('Only draft invoices can be issued.');
    }

    const now = new Date();
    const dueDate =
      invoice.dueDate ??
      (() => {
        const d = new Date(now);
        d.setUTCDate(d.getUTCDate() + 30);
        return d;
      })();

    const updated = await this.prisma.invoice.update({
      where: { id },
      data: {
        status: BillingInvoiceStatus.unpaid,
        issuedAt: now,
        dueDate,
      },
      select: INVOICE_SELECT,
    });
    this.emitInvoice(updated, 'invoice_issued');
    return updated;
  }

  async createAdHoc(user: AuthPrincipal, dto: CreateAdHocInvoiceDto) {
    this.companyAccess.assertCompanyAccess(user, dto.companyId);
    if (!dto.lines?.length) {
      throw new BadRequestException('At least one invoice line is required.');
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.create({
        data: {
          companyId: dto.companyId,
          invoiceSource: BillingInvoiceSource.ad_hoc,
          status: BillingInvoiceStatus.draft,
          issuedAt: new Date(dto.invoiceDate),
          dueDate: new Date(dto.dueDate),
        },
      });

      for (const line of dto.lines) {
        await this.createManualLineTx(tx, invoice.id, line);
      }

      await this.invoiceCalc.applyInvoiceTotals(tx, invoice.id);

      return tx.invoice.findUniqueOrThrow({
        where: { id: invoice.id },
        select: INVOICE_SELECT,
      });
    });
    this.emitInvoice(created, 'invoice_created');
    return created;
  }

  async updateInvoice(user: AuthPrincipal, id: string, dto: UpdateInvoiceDto) {
    const invoice = await this.findById(user, id);
    if (invoice.status !== BillingInvoiceStatus.draft) {
      throw new BadRequestException('Only draft invoices can be edited.');
    }

    const data: Prisma.InvoiceUpdateInput = {};

    if (dto.invoiceDate) {
      data.issuedAt = new Date(dto.invoiceDate);
    }
    if (dto.dueDate) {
      data.dueDate = new Date(dto.dueDate);
    }
    if (dto.discountType !== undefined) {
      data.discountType =
        dto.discountType === null ? null : (dto.discountType as BillingDiscountType);
    }
    if (dto.discountValue !== undefined) {
      data.discountValue =
        dto.discountValue == null ? null : new Prisma.Decimal(dto.discountValue);
    }
    if (dto.vatPercentage != null) {
      data.vatPercentage = new Prisma.Decimal(dto.vatPercentage);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.invoice.update({ where: { id }, data });
      await this.invoiceCalc.applyInvoiceTotals(tx, id);
      return tx.invoice.findUniqueOrThrow({ where: { id }, select: INVOICE_SELECT });
    });
    this.emitInvoice(updated, 'invoice_updated');
    return updated;
  }

  async listPage(user: AuthPrincipal, query: ListBillingInvoicesQueryDto) {
    const where = this.buildInvoiceWhere(user, query);
    const orderBy = this.buildInvoiceOrderBy(query);

    const [items, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        orderBy,
        skip: query.offset,
        take: query.limit,
        select: INVOICE_SELECT,
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return { items, total, limit: query.limit, offset: query.offset };
  }

  list(user: AuthPrincipal, companyId?: string) {
    const where: Prisma.InvoiceWhereInput = {};
    if (companyId) {
      this.companyAccess.assertCompanyAccess(user, companyId);
      where.companyId = companyId;
    } else if (user.tenantScope === 'restricted') {
      where.companyId = { in: user.authorizedCompanyIds };
    }
    return this.prisma.invoice.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: INVOICE_SELECT,
    });
  }

  async findById(user: AuthPrincipal, id: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      select: INVOICE_SELECT,
    });
    if (!invoice) throw new NotFoundException('Invoice not found.');
    this.companyAccess.assertCompanyAccess(user, invoice.companyId);
    return invoice;
  }

  async getForPdf(user: AuthPrincipal, id: string) {
    const invoice = await this.findById(user, id);
    const company = await this.prisma.company.findUnique({
      where: { id: invoice.companyId },
      select: {
        name: true,
        tradeName: true,
        contactEmail: true,
        contactPhone: true,
        address: true,
        city: true,
        country: true,
      },
    });
    return { invoice, company };
  }

  async addLine(user: AuthPrincipal, invoiceId: string, dto: CreateInvoiceLineDto) {
    const invoice = await this.findById(user, invoiceId);
    if (invoice.status !== BillingInvoiceStatus.draft) {
      throw new BadRequestException('Lines can only be added to draft invoices.');
    }

    return this.prisma.$transaction(async (tx) => {
      const line = await this.createManualLineTx(tx, invoiceId, dto);
      await this.invoiceCalc.applyInvoiceTotals(tx, invoiceId);
      return line;
    });
  }

  async updateManualLine(
    user: AuthPrincipal,
    invoiceId: string,
    lineId: string,
    dto: UpdateManualInvoiceLineDto,
  ) {
    const invoice = await this.findById(user, invoiceId);
    if (invoice.status !== BillingInvoiceStatus.draft) {
      throw new BadRequestException('Only draft invoices can be edited.');
    }

    const line = await this.prisma.invoiceLine.findFirst({
      where: { id: lineId, invoiceId, lineSource: BillingInvoiceLineSource.manual },
    });
    if (!line) throw new NotFoundException('Manual invoice line not found.');

    const quantity = dto.quantity != null ? new Prisma.Decimal(dto.quantity) : line.quantity;
    const unitPrice = dto.unitPrice != null ? new Prisma.Decimal(dto.unitPrice) : line.unitPrice;
    const totalPrice = quantity.mul(unitPrice).toDecimalPlaces(2);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.invoiceLine.update({
        where: { id: lineId },
        data: {
          description: dto.description?.trim(),
          quantity,
          unitPrice,
          totalPrice,
        },
      });
      await this.invoiceCalc.applyInvoiceTotals(tx, invoiceId);
      return updated;
    });
  }

  async removeManualLine(user: AuthPrincipal, invoiceId: string, lineId: string) {
    const invoice = await this.findById(user, invoiceId);
    if (invoice.status !== BillingInvoiceStatus.draft) {
      throw new BadRequestException('Only draft invoices can be edited.');
    }

    const line = await this.prisma.invoiceLine.findFirst({
      where: { id: lineId, invoiceId, lineSource: BillingInvoiceLineSource.manual },
    });
    if (!line) throw new NotFoundException('Manual invoice line not found.');

    return this.prisma.$transaction(async (tx) => {
      await tx.invoiceLine.delete({ where: { id: lineId } });
      await this.invoiceCalc.applyInvoiceTotals(tx, invoiceId);
      return { ok: true };
    });
  }

  private async createManualLineTx(
    tx: Prisma.TransactionClient,
    invoiceId: string,
    dto: CreateManualInvoiceLineDto | CreateInvoiceLineDto,
  ) {
    const quantity = new Prisma.Decimal(dto.quantity);
    const unitPrice = new Prisma.Decimal(dto.unitPrice);
    const totalPrice = quantity.mul(unitPrice).toDecimalPlaces(2);

    return tx.invoiceLine.create({
      data: {
        invoiceId,
        type: BillingInvoiceLineType.manual,
        lineSource: BillingInvoiceLineSource.manual,
        description: dto.description.trim(),
        quantity,
        unitPrice,
        totalPrice,
      },
    });
  }

  private buildInvoiceWhere(
    user: AuthPrincipal,
    query: ListBillingInvoicesQueryDto,
  ): Prisma.InvoiceWhereInput {
    const where: Prisma.InvoiceWhereInput = {};

    if (query.companyId) {
      this.companyAccess.assertCompanyAccess(user, query.companyId);
      where.companyId = query.companyId;
    } else if (user.tenantScope === 'restricted') {
      where.companyId = { in: user.authorizedCompanyIds };
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.search?.trim()) {
      const term = query.search.trim();
      where.invoiceNumber = { contains: term, mode: 'insensitive' };
    }

    if (query.createdFrom || query.createdTo) {
      where.createdAt = {};
      if (query.createdFrom) {
        where.createdAt.gte = new Date(query.createdFrom);
      }
      if (query.createdTo) {
        const to = new Date(query.createdTo);
        to.setUTCHours(23, 59, 59, 999);
        where.createdAt.lte = to;
      }
    }

    const cycleWhere: Prisma.BillingCycleWhereInput = {};
    if (query.cycleStatus) {
      cycleWhere.status = query.cycleStatus;
    }
    if (query.expiryFrom || query.expiryTo) {
      cycleWhere.endsAt = {};
      if (query.expiryFrom) {
        cycleWhere.endsAt.gte = new Date(query.expiryFrom);
      }
      if (query.expiryTo) {
        const to = new Date(query.expiryTo);
        to.setUTCHours(23, 59, 59, 999);
        cycleWhere.endsAt.lte = to;
      }
    }
    if (Object.keys(cycleWhere).length > 0) {
      where.billingCycle = cycleWhere;
    }

    return where;
  }

  private buildInvoiceOrderBy(
    query: ListBillingInvoicesQueryDto,
  ): Prisma.InvoiceOrderByWithRelationInput {
    const dir = query.sort_dir === 'asc' ? 'asc' : 'desc';
    switch (query.sort_by) {
      case 'invoiceNumber':
        return { invoiceNumber: dir };
      case 'totalAmount':
        return { totalAmount: dir };
      case 'status':
        return { status: dir };
      case 'issuedAt':
        return { issuedAt: dir };
      case 'createdAt':
      default:
        return { createdAt: dir };
    }
  }
}
