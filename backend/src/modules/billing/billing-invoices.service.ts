import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AuthPrincipal } from '../../common/auth/current-user.types';
import { CompanyAccessService } from '../../common/company-access/company-access.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateInvoiceLineDto } from './dto/create-invoice-line.dto';

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
  ) {}

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
}
