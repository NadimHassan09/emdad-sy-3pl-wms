import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PrismaService } from '../common/prisma/prisma.service';
import { DocumentBranding, resolveBranding } from './branding';
import { buildLabels, formatDocDate } from './i18n';
import { brandContext, footerContext } from './pdf-context.util';
import { PdfService } from './pdf.service';

const LINE_TYPE_LABELS: Record<string, string> = {
  subscription: 'Fixed subscription',
  inbound: 'Inbound orders',
  outbound: 'Outbound orders',
  packaging: 'Packaging',
  quality_check: 'Quality check',
  excess_volume: 'Excess volume',
  excess_weight: 'Excess weight',
  manual: 'Manual charge',
  order_charge: 'Order charge (VAS)',
};

@Injectable()
export class InvoicePdfService {
  private readonly logger = new Logger(InvoicePdfService.name);
  private readonly branding: DocumentBranding;

  constructor(
    private readonly prisma: PrismaService,
    private readonly pdf: PdfService,
    config: ConfigService,
  ) {
    this.branding = resolveBranding(config);
  }

  async renderInvoicePdf(invoiceId: string): Promise<Buffer> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        company: {
          select: {
            name: true,
            tradeName: true,
            contactEmail: true,
            contactPhone: true,
            address: true,
            city: true,
            country: true,
          },
        },
        billingCycle: {
          select: { startsAt: true, endsAt: true },
        },
        lines: {
          orderBy: [{ lineSource: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });
    if (!invoice) {
      throw new NotFoundException(`Invoice ${invoiceId} not found`);
    }

    const lang = 'en' as const;
    const L = {
      ...buildLabels(lang),
      description: 'Description',
      quantity: 'Qty',
      unitPrice: 'Unit price',
      total: 'Total',
      billTo: 'Bill to',
      invoiceDetails: 'Invoice details',
      dueDate: 'Due date',
      billingCycle: 'Billing cycle',
      subtotal: 'Subtotal',
      discount: 'Discount',
      vat: 'VAT',
      grandTotal: 'Grand total',
    };

    const cycleLabel =
      invoice.billingCycle != null
        ? `${formatDocDate(invoice.billingCycle.startsAt, lang)} – ${formatDocDate(invoice.billingCycle.endsAt, lang)}`
        : null;

    const lines = invoice.lines.map((line) => ({
      description:
        line.description?.trim() ||
        LINE_TYPE_LABELS[line.type] ||
        line.type.replace(/_/g, ' '),
      quantity: Number(line.quantity).toFixed(2),
      unitPrice: Number(line.unitPrice).toFixed(2),
      total: Number(line.totalPrice).toFixed(2),
    }));

    const context = {
      lang,
      dir: 'ltr' as const,
      L,
      brand: brandContext(this.branding, lang, this.pdf.logo),
      header: {
        titleMain: 'Tax Invoice',
        titleAbbr: 'Invoice',
        referenceNo: `Invoice No: ${invoice.invoiceNumber}`,
        issueDate: invoice.issuedAt
          ? formatDocDate(invoice.issuedAt, lang)
          : formatDocDate(invoice.createdAt, lang),
        barcode: '',
      },
      customer: {
        name: invoice.company.tradeName || invoice.company.name,
        email: invoice.company.contactEmail ?? '',
        phone: invoice.company.contactPhone ?? '',
        address: [invoice.company.address, invoice.company.city, invoice.company.country]
          .filter(Boolean)
          .join(', '),
      },
      dueDate: invoice.dueDate ? formatDocDate(invoice.dueDate, lang) : '—',
      cycleLabel,
      lines,
      totals: {
        subtotal: Number(invoice.subtotalAmount).toFixed(2),
        discount: Number(invoice.discountAmount) > 0
          ? Number(invoice.discountAmount).toFixed(2)
          : '',
        vatPercentage: Number(invoice.vatPercentage).toFixed(2),
        vat: Number(invoice.vatAmount).toFixed(2),
        grandTotal: Number(invoice.grandTotal).toFixed(2),
      },
    };

    const footer = footerContext(this.branding, lang, buildLabels(lang));
    return this.pdf.render('invoice', context, footer);
  }
}
