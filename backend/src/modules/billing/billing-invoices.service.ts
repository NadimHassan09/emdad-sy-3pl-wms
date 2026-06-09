import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BillingInvoiceStatus, Prisma } from '@prisma/client';

import { AuthPrincipal } from '../../common/auth/current-user.types';
import { CompanyAccessService } from '../../common/company-access/company-access.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { BillingAuditService, BILLING_AUDIT_ACTIONS } from './billing-audit.service';
import { CreateInvoiceLineDto } from './dto/create-invoice-line.dto';
import { ListBillingInvoicesQueryDto } from './dto/list-billing-invoices-query.dto';

const INVOICE_SELECT = {
  id: true,
  companyId: true,
  billingCycleId: true,
  invoiceNumber: true,
  status: true,
  totalAmount: true,
  issuedAt: true,
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
      quantity: true,
      unitPrice: true,
      totalPrice: true,
    },
  },
} satisfies Prisma.InvoiceSelect;

@Injectable()
export class BillingInvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyAccess: CompanyAccessService,
    private readonly billingAudit: BillingAuditService,
  ) {}

  async updateStatus(
    user: AuthPrincipal,
    id: string,
    status: 'paid' | 'cancelled' | 'open',
  ) {
    const invoice = await this.findById(user, id);
    const allowed: Record<string, BillingInvoiceStatus[]> = {
      paid: [BillingInvoiceStatus.open, BillingInvoiceStatus.overdue],
      cancelled: [
        BillingInvoiceStatus.draft,
        BillingInvoiceStatus.open,
        BillingInvoiceStatus.overdue,
      ],
      open: [BillingInvoiceStatus.paid, BillingInvoiceStatus.cancelled],
    };
    const from = invoice.status as BillingInvoiceStatus;
    if (!allowed[status]?.includes(from)) {
      throw new BadRequestException(
        `Cannot transition invoice from ${from} to ${status}.`,
      );
    }

    const updated = await this.prisma.invoice.update({
      where: { id },
      data: { status: status as BillingInvoiceStatus },
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

  async addLine(user: AuthPrincipal, invoiceId: string, dto: CreateInvoiceLineDto) {
    const invoice = await this.findById(user, invoiceId);
    if (invoice.status !== 'draft') {
      throw new BadRequestException('Lines can only be added to draft invoices.');
    }

    const quantity = new Prisma.Decimal(dto.quantity);
    const unitPrice = new Prisma.Decimal(dto.unitPrice);
    const totalPrice = quantity.mul(unitPrice).toDecimalPlaces(2);

    return this.prisma.$transaction(async (tx) => {
      const line = await tx.invoiceLine.create({
        data: {
          invoiceId,
          type: dto.type,
          quantity,
          unitPrice,
          totalPrice,
        },
      });

      const agg = await tx.invoiceLine.aggregate({
        where: { invoiceId },
        _sum: { totalPrice: true },
      });

      await tx.invoice.update({
        where: { id: invoiceId },
        data: { totalAmount: agg._sum.totalPrice ?? new Prisma.Decimal(0) },
      });

      return line;
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
