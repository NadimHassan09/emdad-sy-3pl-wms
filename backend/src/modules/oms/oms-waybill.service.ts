import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as XLSX from 'xlsx';

import { AuthPrincipal } from '../../common/auth/current-user.types';
import { CompanyAccessService } from '../../common/company-access/company-access.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PdfService } from '../../pdf/pdf.service';
import { barcodePngDataUri, qrCodePngDataUri } from '../../pdf/barcode.util';

export type OmsWaybillData = {
  id: string;
  orderNumber: string;
  createdAt: Date;
  company: {
    id: string;
    name: string;
    tradeName?: string | null;
  };
  carrier: string;
  carrierLogoUrl: string | null;
  shippingProviderCode: string | null;
  shippingMethod: string | null;
  trackingNumber: string;
  carrierTrackingNumber: string | null;
  isCarrierAwbFromApi: boolean;
  internalWaybillNumber: string;
  qrCodeData: string;
  recipient: {
    name: string;
    phone: string;
    city: string;
    district: string;
    address: string;
    instructions: string;
  };
  sender: {
    name: string;
    hub: string;
  };
  financials: {
    codAmount: number;
    currency: string;
    shippingFee: number;
    paymentMethod: string;
    total: number;
  };
  items: Array<{
    id: string;
    lineNumber: number;
    sku: string;
    name: string;
    quantity: number;
    unitPrice: number | null;
    lineTotal: number | null;
  }>;
  totalQuantity: number;
  labelUrl: string | null;
};

@Injectable()
export class OmsWaybillService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyAccess: CompanyAccessService,
    private readonly pdfService: PdfService,
  ) {}

  resolveCarrierLogo(
    carrierName: string | null | undefined,
    providerCode: string | null | undefined,
    rawMeta: unknown,
  ): string | null {
    if (rawMeta && typeof rawMeta === 'object') {
      const meta = rawMeta as Record<string, unknown>;
      if (typeof meta.logoUrl === 'string' && meta.logoUrl.trim()) return meta.logoUrl.trim();
      if (typeof meta.courier_logo === 'string' && meta.courier_logo.trim()) return meta.courier_logo.trim();
      if (typeof meta.logo === 'string' && meta.logo.trim()) return meta.logo.trim();
    }

    const norm = `${carrierName || ''} ${providerCode || ''}`.toLowerCase().trim();
    if (norm.includes('babel')) return '/carrier-logos/babel-express.svg';
    if (norm.includes('ترابط') || norm.includes('tarabut')) return '/carrier-logos/tarabut.jpeg';
    if (norm.includes('ديليفرو') || norm.includes('deliveroo')) return '/carrier-logos/deliveroo-joud.svg';
    if (norm.includes('كرم') || norm.includes('karam')) return '/carrier-logos/karam.jpeg';
    if (norm.includes('مسارات') || norm.includes('masarat')) return '/carrier-logos/masarat.png';
    if (norm.includes('مرسال') || norm.includes('mersal')) return '/carrier-logos/mersal.jpeg';
    if (norm.includes('تكامل') || norm.includes('takamol')) return '/carrier-logos/takamol.svg';

    return null;
  }

  async getWaybillData(orderId: string, user: AuthPrincipal): Promise<OmsWaybillData> {
    const order = await this.prisma.omsOrder.findUnique({
      where: { id: orderId },
      include: {
        company: {
          select: { id: true, name: true, tradeName: true },
        },
        lines: {
          include: {
            product: {
              select: { id: true, sku: true, name: true, barcode: true },
            },
          },
          orderBy: { lineNumber: 'asc' },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`OMS order ${orderId} not found.`);
    }

    this.companyAccess.validateResourceOwnership(user, order);

    let carrierShipment = null;
    if (order.outboundOrderId) {
      carrierShipment = await this.prisma.carrierShipment.findFirst({
        where: { outboundOrderId: order.outboundOrderId },
        orderBy: { createdAt: 'desc' },
      });
    }

    const carrierAwbCandidate =
      (carrierShipment?.externalAwb || carrierShipment?.trackingNumber || '').trim() ||
      (order.shippingMethod === 'carrier' && order.trackingNumber ? order.trackingNumber.trim() : '');

    const carrierTrackingNumber = carrierAwbCandidate || null;
    const isCarrierAwbFromApi = Boolean(carrierShipment?.externalAwb || (order.shippingMethod === 'carrier' && order.trackingNumber));

    const internalWaybillNumber = order.orderNumber;
    const qrCodeData = order.orderNumber;

    const carrier =
      (
        order.carrier ||
        carrierShipment?.providerCode ||
        ''
      ).trim() || (order.shippingMethod === 'carrier' ? 'Carrier' : 'Manual');

    const carrierLogoUrl = this.resolveCarrierLogo(
      carrier,
      order.shippingProviderCode || carrierShipment?.providerCode,
      carrierShipment?.rawResultMeta,
    );

    const trackingNumber = carrierTrackingNumber || internalWaybillNumber;

    let labelUrl: string | null = null;
    if (carrierShipment?.rawResultMeta && typeof carrierShipment.rawResultMeta === 'object') {
      const meta = carrierShipment.rawResultMeta as Record<string, unknown>;
      if (typeof meta.label_url === 'string') {
        labelUrl = meta.label_url.trim();
      } else if (typeof meta.labelUrl === 'string') {
        labelUrl = meta.labelUrl.trim();
      } else if (typeof meta.url === 'string') {
        labelUrl = meta.url.trim();
      }
    }

    const items = order.lines.map((l) => ({
      id: l.id,
      lineNumber: l.lineNumber,
      sku: l.product?.sku || '—',
      name: l.product?.name || l.productId,
      quantity: Number(l.requestedQuantity),
      unitPrice: l.unitPrice != null ? Number(l.unitPrice) : null,
      lineTotal: l.lineTotal != null ? Number(l.lineTotal) : null,
    }));

    const totalQuantity = items.reduce((acc, item) => acc + item.quantity, 0);

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      createdAt: order.createdAt,
      company: {
        id: order.company.id,
        name: order.company.name,
        tradeName: order.company.tradeName,
      },
      carrier,
      carrierLogoUrl,
      shippingProviderCode: order.shippingProviderCode || carrierShipment?.providerCode || null,
      shippingMethod: order.shippingMethod || null,
      trackingNumber,
      carrierTrackingNumber,
      isCarrierAwbFromApi,
      internalWaybillNumber,
      qrCodeData,
      recipient: {
        name: order.recipientName || '—',
        phone: order.recipientPhone || '—',
        city: order.city || '—',
        district: order.district || '',
        address: order.addressLine1 || order.destinationAddress || '—',
        instructions: order.deliveryInstructions || order.notes || '',
      },
      sender: {
        name: order.company.name,
        hub: 'مستودع إمداد المركزي — دمشق',
      },
      financials: {
        codAmount: Number(order.codAmount ?? 0),
        currency: order.currency || 'USD',
        shippingFee: Number(order.shippingFee ?? 0),
        paymentMethod: order.paymentMethod || 'COD',
        total: Number(order.subtotal ?? 0),
      },
      items,
      totalQuantity,
      labelUrl,
    };
  }

  async generateWaybillPdf(orderId: string, user: AuthPrincipal): Promise<{
    buffer: Buffer;
    filename: string;
  }> {
    const data = await this.getWaybillData(orderId, user);

    const internalBarcodeUri = await barcodePngDataUri(data.internalWaybillNumber);
    const internalQrUri = await qrCodePngDataUri(data.qrCodeData);
    const carrierBarcodeUri = data.carrierTrackingNumber
      ? await barcodePngDataUri(data.carrierTrackingNumber)
      : '';

    const createdFormatted = new Date(data.createdAt).toISOString().split('T')[0];

    const carrierAwbSection = data.carrierTrackingNumber && carrierBarcodeUri
      ? `
        <div style="flex: 1; border: 1.5px solid #0f172a; border-radius: 4px; padding: 4px; background: #fff; text-align: center;">
          <div style="font-size: 7.5px; font-weight: 800; color: #475569; text-transform: uppercase; margin-bottom: 2px;">
            بوليصة الناقل (Carrier AWB)
          </div>
          <img src="${carrierBarcodeUri}" style="max-height: 28px; max-width: 95%; display: block; margin: 0 auto;" />
          <div style="font-family: monospace; font-weight: 800; font-size: 9.5px; letter-spacing: 0.5px; margin-top: 2px; color: #0f172a;">
            ${data.carrierTrackingNumber}
          </div>
          <div style="font-size: 7.5px; color: #16a34a; font-weight: 700;">
            ✓ معتمد (${data.carrier})
          </div>
        </div>
      `
      : `
        <div style="flex: 1; border: 1px dashed #cbd5e1; border-radius: 4px; padding: 4px; background: #f8fafc; text-align: center; display: flex; flex-direction: column; justify-content: center; align-items: center;">
          <div style="font-size: 7.5px; font-weight: 800; color: #64748b; text-transform: uppercase;">
            بوليصة الناقل (Carrier AWB)
          </div>
          <div style="font-size: 8.5px; font-weight: 700; color: #94a3b8; margin: 2px 0;">
            ${data.shippingMethod === 'carrier' ? 'بانتظار الإصدار من API' : 'شحن يدوي'}
          </div>
          <div style="font-size: 7.5px; color: #94a3b8;">
            الناقل: ${data.carrier}
          </div>
        </div>
      `;

    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
        <head>
          <meta charset="utf-8" />
          <title>بوليصة شحن - ${data.orderNumber}</title>
          <style>
            @page {
              size: 100mm 150mm;
              margin: 3mm;
            }
            * { box-sizing: border-box; margin: 0; padding: 0; }
            html, body {
              width: 94mm;
              height: 144mm;
              margin: 0;
              padding: 0;
              background: #ffffff;
              color: #0f172a;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
              font-size: 8.5px;
              line-height: 1.25;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .waybill-container {
              width: 94mm;
              height: 144mm;
              max-height: 144mm;
              border: 1.5px solid #0f172a;
              border-radius: 4px;
              padding: 5px 6px;
              background: #fff;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              box-sizing: border-box;
              overflow: hidden;
            }
            .header-bar {
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-bottom: 1.5px solid #0f172a;
              padding-bottom: 4px;
              margin-bottom: 4px;
            }
            .brand-title {
              font-size: 11px;
              font-weight: 900;
              letter-spacing: 0.3px;
              color: #0f172a;
              line-height: 1.1;
            }
            .brand-subtitle {
              font-size: 8px;
              font-weight: 700;
              color: #475569;
              margin-top: 1px;
            }
            .carrier-pill {
              display: inline-flex;
              align-items: center;
              gap: 4px;
              border: 1px solid #0f172a;
              background: #f8fafc;
              padding: 2px 6px;
              border-radius: 4px;
              font-weight: 800;
              font-size: 8.5px;
              white-space: nowrap;
            }
            .tracking-grid {
              display: flex;
              gap: 4px;
              margin-bottom: 4px;
            }
            .info-grid {
              display: flex;
              gap: 4px;
              margin-bottom: 4px;
            }
            .info-col {
              flex: 1;
              border: 1px solid #cbd5e1;
              border-radius: 4px;
              padding: 4px 5px;
              background: #f8fafc;
            }
            .col-heading {
              font-size: 7.5px;
              font-weight: 800;
              color: #475569;
              text-transform: uppercase;
              border-bottom: 1px solid #e2e8f0;
              padding-bottom: 2px;
              margin-bottom: 3px;
            }
            .cod-highlight {
              border: 1.5px solid #0f172a;
              background: #f1f5f9;
              border-radius: 4px;
              padding: 4px 6px;
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 4px;
            }
            .cod-value {
              font-size: 13px;
              font-weight: 900;
              color: #0f172a;
            }
            table.items-table {
              width: 100%;
              border-collapse: collapse;
              font-size: 8px;
            }
            table.items-table th, table.items-table td {
              border: 1px solid #cbd5e1;
              padding: 2px 4px;
              text-align: right;
            }
            table.items-table th {
              background: #f1f5f9;
              font-weight: 800;
              font-size: 7.5px;
            }
            .footer-sig {
              display: flex;
              justify-content: space-between;
              padding-top: 3px;
              border-top: 1px solid #e2e8f0;
              font-size: 7.5px;
              color: #64748b;
            }
          </style>
        </head>
        <body>
          <div class="waybill-container">
            <!-- Header -->
            <div class="header-bar">
              <div>
                <div class="brand-title">EMDAD LOGISTICS SERVICES</div>
                <div class="brand-subtitle">إمداد للخدمات اللوجستية · بوليصة شحن (10×15 سم)</div>
                <div style="font-size: 8px; color: #64748b; margin-top: 2px;">
                  طلب: <strong style="font-family: monospace; color: #0f172a;">${data.orderNumber}</strong> · ${createdFormatted}
                </div>
              </div>
              <div class="carrier-pill">
                <span>الناقل: <strong>${data.carrier}</strong></span>
              </div>
            </div>

            <!-- Two Distinct Tracking Codes + QR Code -->
            <div class="tracking-grid">
              <!-- Internal Waybill Section with Barcode & QR Code -->
              <div style="flex: 1; border: 1.5px solid #0f172a; border-radius: 4px; padding: 4px; background: #fff; display: flex; gap: 4px; align-items: center;">
                <div style="flex: 1; text-align: center; overflow: hidden;">
                  <div style="font-size: 7.5px; font-weight: 800; color: #475569; text-transform: uppercase; margin-bottom: 2px;">
                    رقم بوليصة إمداد الداخلي
                  </div>
                  <img src="${internalBarcodeUri}" style="max-height: 28px; max-width: 95%; display: block; margin: 0 auto;" />
                  <div style="font-family: monospace; font-weight: 800; font-size: 9.5px; letter-spacing: 0.5px; margin-top: 2px; color: #0f172a;">
                    ${data.internalWaybillNumber}
                  </div>
                </div>
                <div style="padding: 2px; border: 1px solid #e2e8f0; border-radius: 4px; background: #fafafa; display: flex; flex-direction: column; align-items: center; justify-content: center; flex-shrink: 0;">
                  <img src="${internalQrUri}" style="width: 38px; height: 38px; display: block;" alt="Internal QR" />
                  <span style="font-size: 6.5px; font-weight: 800; color: #475569; margin-top: 1px;">QR</span>
                </div>
              </div>

              <!-- Carrier AWB Section -->
              ${carrierAwbSection}
            </div>

            <!-- Sender & Recipient -->
            <div class="info-grid">
              <div class="info-col">
                <div class="col-heading">المرسل (Sender)</div>
                <div style="font-weight: 800; font-size: 9px; color: #0f172a;">${data.company.name}</div>
                <div style="color: #475569; font-size: 8px; margin-top: 1px;">${data.sender.hub}</div>
              </div>
              <div class="info-col">
                <div class="col-heading">المستلم (Recipient)</div>
                <div style="display: flex; justify-content: space-between; font-size: 8.5px;">
                  <strong style="color: #0f172a;">${data.recipient.name}</strong>
                  <span style="font-family: monospace; font-weight: 700;">${data.recipient.phone}</span>
                </div>
                <div style="color: #334155; margin-top: 1px; font-size: 8px;">
                  📍 <strong>${data.recipient.city}</strong>${data.recipient.district ? ` - ${data.recipient.district}` : ''}
                </div>
                <div style="color: #64748b; font-size: 7.5px; margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                  ${data.recipient.address}
                </div>
                ${data.recipient.instructions ? `<div style="color: #b45309; font-size: 7.5px; margin-top: 1px;"><strong>ملاحظة:</strong> ${data.recipient.instructions}</div>` : ''}
              </div>
            </div>

            <!-- COD & Financials -->
            <div class="cod-highlight">
              <div>
                <div style="font-size: 7.5px; font-weight: 800; color: #475569; text-transform: uppercase;">
                  التحصيل عند الاستلام (COD)
                </div>
                <div class="cod-value">
                  ${data.financials.codAmount.toLocaleString('en-US')} ${data.financials.currency}
                </div>
              </div>
              <div style="display: flex; gap: 12px; font-size: 8.5px;">
                <div>
                  <span style="color: #64748b; display: block; font-size: 7.5px;">أجور الشحن</span>
                  <strong>${data.financials.shippingFee > 0 ? `${data.financials.shippingFee} ${data.financials.currency}` : 'متضمنة'}</strong>
                </div>
                <div>
                  <span style="color: #64748b; display: block; font-size: 7.5px;">طريقة الدفع</span>
                  <strong>${data.financials.paymentMethod}</strong>
                </div>
              </div>
            </div>

            <!-- Items Table -->
            <div style="margin-bottom: 3px;">
              <div style="display: flex; justify-content: space-between; font-size: 7.5px; font-weight: 800; color: #475569; margin-bottom: 2px;">
                <span>محتويات الشحنة</span>
                <span>إجمالي القطع: ${data.totalQuantity}</span>
              </div>
              <table class="items-table">
                <thead>
                  <tr>
                    <th style="width: 20px; text-align: center;">#</th>
                    <th>المنتج</th>
                    <th style="width: 80px;">الرمز (SKU)</th>
                    <th style="width: 32px; text-align: center;">الكمية</th>
                  </tr>
                </thead>
                <tbody>
                  ${data.items.slice(0, 4)
                    .map(
                      (item, idx) => `
                    <tr>
                      <td style="text-align: center; font-family: monospace;">${idx + 1}</td>
                      <td><strong>${item.name}</strong></td>
                      <td style="font-family: monospace; color: #475569; font-size: 7.5px;">${item.sku}</td>
                      <td style="text-align: center; font-weight: 800;">${item.quantity}</td>
                    </tr>
                  `,
                    )
                    .join('')}
                  ${data.items.length > 4 ? `
                    <tr>
                      <td colspan="4" style="text-align: center; font-weight: 700; color: #475569; background: #f8fafc; font-size: 7.5px;">
                        + ${data.items.length - 4} أصناف إضافية (إجمالي الشحنة: ${data.totalQuantity} قطعة)
                      </td>
                    </tr>
                  ` : ''}
                </tbody>
              </table>
            </div>

            <!-- Signatures -->
            <div class="footer-sig">
              <div>توقيع المستلم: ______________________</div>
              <div>تاريخ الاستلام: ____ / ____ / 202_</div>
            </div>
          </div>
        </body>
      </html>
    `;

    const buffer = await this.pdfService.renderHtml(html, {
      width: '100mm',
      height: '150mm',
      margin: { top: '3mm', bottom: '3mm', left: '3mm', right: '3mm' },
    });
    const filename = `Waybill_${data.orderNumber}.pdf`;

    return { buffer, filename };
  }

  async exportWaybillsExcel(orderIds: string[], user: AuthPrincipal): Promise<{
    buffer: Buffer;
    filename: string;
    count: number;
  }> {
    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      throw new BadRequestException('No order IDs provided for waybill export.');
    }

    const uniqueIds = Array.from(new Set(orderIds.slice(0, 500)));

    const orders = await this.prisma.omsOrder.findMany({
      where: {
        id: { in: uniqueIds },
      },
      include: {
        company: {
          select: { id: true, name: true },
        },
        lines: {
          include: {
            product: {
              select: { id: true, sku: true, name: true },
            },
          },
          orderBy: { lineNumber: 'asc' },
        },
      },
      orderBy: { orderNumber: 'asc' },
    });

    for (const order of orders) {
      this.companyAccess.validateResourceOwnership(user, order);
    }

    const rows = orders.map((order, idx) => {
      const tracking = (order.trackingNumber || '').trim() || '—';
      const carrier = (order.carrier || '').trim() || (order.shippingMethod === 'manual' ? 'شحن يدوي (Manual)' : '—');
      const itemsList = order.lines
        .map((l) => `${l.product?.name || l.productId} (${l.product?.sku || 'SKU'}) × ${Number(l.requestedQuantity)}`)
        .join(' \n');
      const totalPieces = order.lines.reduce((s, l) => s + Number(l.requestedQuantity), 0);
      const orderDate = order.createdAt ? new Date(order.createdAt).toISOString().split('T')[0] : '';

      return {
        '#': idx + 1,
        'رقم الطلب': order.orderNumber,
        'تاريخ الطلب': orderDate,
        'شركة الشحن': carrier,
        'رقم البوليصة / التتبع (AWB)': tracking,
        'المتجر / العميل': order.company?.name || '—',
        'اسم المستلم': order.recipientName || '—',
        'هاتف المستلم': order.recipientPhone || '—',
        'المحافظة / المدينة': order.city || '—',
        'المنطقة': order.district || '—',
        'العنوان التفصيلي': order.addressLine1 || order.destinationAddress || '—',
        'المبلغ المطلوب تحصيله (COD)': Number(order.codAmount ?? 0),
        'العملة': order.currency || 'USD',
        'أجور الشحن': Number(order.shippingFee ?? 0),
        'إجمالي عدد القطع': totalPieces,
        'محتويات الشحنة': itemsList,
        'تعليمات وملاحظات': order.deliveryInstructions || order.notes || '—',
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);

    worksheet['!cols'] = [
      { wch: 5 },  // #
      { wch: 18 }, // رقم الطلب
      { wch: 13 }, // تاريخ الطلب
      { wch: 18 }, // شركة الشحن
      { wch: 26 }, // رقم البوليصة / التتبع
      { wch: 22 }, // المتجر / العميل
      { wch: 22 }, // اسم المستلم
      { wch: 18 }, // هاتف المستلم
      { wch: 16 }, // المحافظة / المدينة
      { wch: 16 }, // المنطقة
      { wch: 32 }, // العنوان التفصيلي
      { wch: 18 }, // COD
      { wch: 10 }, // العملة
      { wch: 14 }, // أجور الشحن
      { wch: 14 }, // إجمالي عدد القطع
      { wch: 45 }, // محتويات الشحنة
      { wch: 30 }, // تعليمات وملاحظات
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'بوالص الشحن (Waybills)');

    const buffer = XLSX.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx',
    });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `Waybills_${timestamp}.xlsx`;

    return {
      buffer,
      filename,
      count: orders.length,
    };
  }
}
