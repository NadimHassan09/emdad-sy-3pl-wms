import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AuthPrincipal } from '../../common/auth/current-user.types';
import { CompanyAccessService } from '../../common/company-access/company-access.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { BillingInvoiceCalculationService } from './billing-invoice-calculation.service';
import { CreateOrderManualChargeDto } from './dto/create-order-manual-charge.dto';
import { UpdateOrderManualChargeDto } from './dto/update-order-manual-charge.dto';

const CHARGE_SELECT = {
  id: true,
  companyId: true,
  referenceType: true,
  referenceId: true,
  description: true,
  quantity: true,
  unitPrice: true,
  totalPrice: true,
  createdBy: true,
  createdAt: true,
} satisfies Prisma.OrderManualChargeSelect;

@Injectable()
export class OrderManualChargesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyAccess: CompanyAccessService,
    private readonly invoiceCalc: BillingInvoiceCalculationService,
  ) {}

  async listForReference(
    user: AuthPrincipal,
    referenceType: string,
    referenceId: string,
  ) {
    const companyId = await this.resolveReferenceCompanyId(referenceType, referenceId);
    this.companyAccess.assertCompanyAccess(user, companyId);
    return this.prisma.orderManualCharge.findMany({
      where: { referenceType, referenceId },
      orderBy: { createdAt: 'asc' },
      select: CHARGE_SELECT,
    });
  }

  async create(user: AuthPrincipal, dto: CreateOrderManualChargeDto) {
    const companyId = await this.resolveReferenceCompanyId(dto.referenceType, dto.referenceId);
    this.companyAccess.assertCompanyAccess(user, companyId);

    const quantity = new Prisma.Decimal(dto.quantity);
    const unitPrice = new Prisma.Decimal(dto.unitPrice);
    const totalPrice = quantity.mul(unitPrice).toDecimalPlaces(2);

    const charge = await this.prisma.orderManualCharge.create({
      data: {
        companyId,
        referenceType: dto.referenceType,
        referenceId: dto.referenceId,
        description: dto.description.trim(),
        quantity,
        unitPrice,
        totalPrice,
        createdBy: user.id,
      },
      select: CHARGE_SELECT,
    });

    void this.invoiceCalc.recalculateForCompany(companyId, 'order_manual_charge');
    return charge;
  }

  async update(user: AuthPrincipal, id: string, dto: UpdateOrderManualChargeDto) {
    const existing = await this.prisma.orderManualCharge.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Order manual charge not found.');
    this.companyAccess.assertCompanyAccess(user, existing.companyId);

    const quantity =
      dto.quantity != null ? new Prisma.Decimal(dto.quantity) : existing.quantity;
    const unitPrice =
      dto.unitPrice != null ? new Prisma.Decimal(dto.unitPrice) : existing.unitPrice;
    const totalPrice = quantity.mul(unitPrice).toDecimalPlaces(2);

    const charge = await this.prisma.orderManualCharge.update({
      where: { id },
      data: {
        description: dto.description?.trim(),
        quantity,
        unitPrice,
        totalPrice,
      },
      select: CHARGE_SELECT,
    });

    void this.invoiceCalc.recalculateForCompany(existing.companyId, 'order_manual_charge');
    return charge;
  }

  async remove(user: AuthPrincipal, id: string) {
    const existing = await this.prisma.orderManualCharge.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Order manual charge not found.');
    this.companyAccess.assertCompanyAccess(user, existing.companyId);

    await this.prisma.orderManualCharge.delete({ where: { id } });
    void this.invoiceCalc.recalculateForCompany(existing.companyId, 'order_manual_charge');
    return { ok: true };
  }

  private async resolveReferenceCompanyId(
    referenceType: string,
    referenceId: string,
  ): Promise<string> {
    if (referenceType === 'inbound_order') {
      const order = await this.prisma.inboundOrder.findUnique({
        where: { id: referenceId },
        select: { companyId: true },
      });
      if (!order) throw new NotFoundException('Inbound order not found.');
      return order.companyId;
    }
    if (referenceType === 'outbound_order') {
      const order = await this.prisma.outboundOrder.findUnique({
        where: { id: referenceId },
        select: { companyId: true },
      });
      if (!order) throw new NotFoundException('Outbound order not found.');
      return order.companyId;
    }
    throw new BadRequestException('referenceType must be inbound_order or outbound_order.');
  }
}
