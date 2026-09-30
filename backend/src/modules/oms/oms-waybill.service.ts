import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PdfService } from '../../pdf/pdf.service';
import { AuthPrincipal } from '../../common/auth/current-user.types';
import { OmsWaybillData, OmsWaybillItem } from './oms-order.types';
import * as XLSX from 'xlsx';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const QRCode = require('qrcode');

async function qrCodePngDataUri(text: string): Promise<string> {
  if (!text) return '';
  try {
    return await QRCode.toDataURL(text, {
      margin: 1,
      width: 180,
      color: { dark: '#0f172a', light: '#ffffff' },
    });
  } catch (err) {
    console.warn('Failed to generate QR code data URI:', err);
    return '';
  }
}

@Injectable()
export class OmsWaybillService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pdfService: PdfService,
  ) {}

  async getWaybillData(orderId: string, user: AuthPrincipal): Promise<OmsWaybillData> {
    const order = await this.prisma.omsOrder.findFirst({
      where: {
        id: orderId,
        ...(user.companyId ? { companyId: user.companyId } : {}),
      },
      include: {
        company: true,
        lines: {
          include: {
            product: true,
          },
        },
        outboundOrder: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    let carrierShipment = null;
    if (order.outboundOrderId) {
      carrierShipment = await this.prisma.carrierShipment.findFirst({
        where: { outboundOrderId: order.outboundOrderId },
        orderBy: { createdAt: 'desc' },
        include: { provider: true },
      });
    }

    let carrierName = 'إمداد اكسبرس (داخلي)';
    let carrierLogoUrl: string | undefined = undefined;
    let isCarrierAwbFromApi = false;
    let carrierTrackingNumber = order.trackingNumber || order.outboundOrder?.trackingNumber || undefined;

    if (carrierShipment) {
      carrierName = (carrierShipment as any).provider?.name || carrierShipment.providerCode || 'شركة شحن';
      carrierLogoUrl = undefined;
      isCarrierAwbFromApi = (carrierShipment.trackingNumber === carrierTrackingNumber || carrierShipment.externalAwb === carrierTrackingNumber) && !!carrierTrackingNumber;
    } else if (order.carrier) {
      carrierName = order.carrier;
    }

    const items: OmsWaybillItem[] = (order.lines || []).map((line: any) => ({
      id: line.id,
      name: line.product?.title || line.product?.name || 'منتج',
      sku: line.product?.sku || '—',
      quantity: Number(line.requestedQuantity ?? 1),
      price: Number(line.unitPrice ?? 0),
    }));

    const totalQuantity = items.reduce((sum: number, item: OmsWaybillItem) => sum + item.quantity, 0);

    const internalWaybillNumber = order.trackingNumber || `EMD-${order.orderNumber}`;
    const qrCodeData = order.trackingNumber || order.orderNumber;

    let labelUrl: string | undefined = undefined;

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      internalWaybillNumber,
      carrierTrackingNumber,
      carrier: carrierName,
      carrierLogoUrl,
      isCarrierAwbFromApi,
      shippingMethod: carrierShipment ? 'carrier' : 'manual',
      createdAt: order.createdAt.toISOString(),
      qrCodeData,
      company: {
        id: order.company.id,
        name: order.company.name,
        tradeName: (order.company as any).tradeName || undefined,
        logoUrl: (order.company as any).logoUrl || undefined,
      },
      recipient: {
        name: order.recipientName || 'عميل',
        phone: order.recipientPhone || '—',
        city: order.city || '—',
        district: order.district || '',
        address: order.addressLine1 || order.destinationAddress || '—',
        instructions: order.deliveryInstructions || order.notes || '',
      },
      sender: {
        name: (order.company as any).tradeName || order.company.name,
        phone: (order.company as any).contactPhone || '',
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

    const internalQrUri = await qrCodePngDataUri(data.qrCodeData);
    const carrierQrUri = data.carrierTrackingNumber
      ? await qrCodePngDataUri(data.carrierTrackingNumber)
      : '';

    const createdFormatted = new Date(data.createdAt).toISOString().split('T')[0];
    const emdadLogoUri = this.pdfService.logo;

    const carrierLogoHtml = data.carrierLogoUrl
      ? `<img src="${data.carrierLogoUrl}" style="max-height: 22px; max-width: 70px; object-fit: contain; display: block;" />`
      : `<span style="font-weight: 800; font-size: 8.5px; color: #14532d;">${data.carrier}</span>`;

    const certifiedBadge = data.isCarrierAwbFromApi
      ? `<div style="display: inline-block; background: #f0fdf4; color: #14532d; border: 1px solid #86efac; border-radius: 3px; padding: 1px 5px; font-size: 6.5px; font-weight: 800; margin-bottom: 2px;">✓ معتمد من ${data.carrier}</div>`
      : '';

    const internalSection = `
      <div style="flex: 1; border: 1.5px solid #14532d; border-radius: 5px; padding: 4px; background: #fff; text-align: center;">
        <div style="font-size: 7.5px; font-weight: 800; color: #14532d; margin-bottom: 2px;">رقم بوليصة إمداد الداخلي</div>
        <div style="font-family: monospace; font-weight: 900; font-size: 8.5px; color: #0f172a; margin-bottom: 3px; word-break: break-all;">${data.internalWaybillNumber}</div>
        ${internalQrUri ? `<img src="${internalQrUri}" style="width: 100%; height: auto; max-height: 55px; object-fit: contain; display: block; margin: 0 auto;" />` : ''}
      </div>
    `;

    const awbSection = data.carrierTrackingNumber && carrierQrUri
      ? `
        <div style="flex: 1; border: 1.5px solid #14532d; border-radius: 5px; padding: 4px; background: #fff; text-align: center;">
          <div style="font-size: 7.5px; font-weight: 800; color: #0f172a; margin-bottom: 2px;">رقم التتبع لدى الناقل (AWB)</div>
          ${certifiedBadge}
          <div style="font-family: monospace; font-weight: 900; font-size: 8px; color: #0f172a; margin-bottom: 3px; word-break: break-all;">${data.carrierTrackingNumber}</div>
          <img src="${carrierQrUri}" style="width: 100%; height: auto; max-height: 55px; object-fit: contain; display: block; margin: 0 auto;" />
        </div>
      `
      : `
        <div style="flex: 1; border: 1px dashed #cbd5e1; border-radius: 5px; padding: 4px; background: #f8fafc; text-align: center; display: flex; flex-direction: column; justify-content: center; align-items: center;">
          <div style="font-size: 7.5px; font-weight: 800; color: #64748b; margin-bottom: 2px;">رقم التتبع لدى الناقل (AWB)</div>
          <div style="font-size: 8px; font-weight: 700; color: #94a3b8;">${data.shippingMethod === 'carrier' ? 'بانتظار الإصدار' : 'شحن يدوي'}</div>
        </div>
      `;

    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
        <head>
          <meta charset="utf-8" />
          <title>بوليصة شحن - ${data.orderNumber}</title>
          <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet">
          <style>
            @page { size: 100mm 150mm; margin: 2mm; }
            * { box-sizing: border-box; margin: 0; padding: 0; }
            html, body {
              width: 96mm; height: 146mm;
              background: #fff; color: #0f172a;
              font-family: 'Cairo', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
              font-size: 8px; line-height: 1.3;
              -webkit-print-color-adjust: exact; print-color-adjust: exact;
            }
            .waybill {
              width: 96mm; height: 146mm; max-height: 146mm;
              border: 2px solid #14532d; border-radius: 6px;
              padding: 4px 5px; background: #fff;
              display: flex; flex-direction: column; gap: 4px;
              overflow: hidden;
            }
            .section-hdr {
              background: #14532d; color: #ffffff;
              padding: 3px 6px; font-weight: 800; font-size: 8px;
            }
            .section-body {
              background: #f0fdf4; padding: 4px 6px;
            }
            table.items-table { width: 100%; border-collapse: collapse; font-size: 7.5px; }
            table.items-table th, table.items-table td { border: 1px solid #cbd5e1; padding: 2px 3px; text-align: right; }
            table.items-table th { background: #14532d; color: #ffffff; font-weight: 800; font-size: 7px; text-align: center; }
          </style>
        </head>
        <body>
          <div class="waybill">

            <!-- ═══ HEADER ═══ -->
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #14532d; padding-bottom: 4px;">
              <!-- Waybill badge (Left) -->
              <div style="background: #14532d; color: #ffffff; border-radius: 5px; padding: 4px 10px; text-align: center;">
                <div style="font-size: 13px; font-weight: 900; line-height: 1; color: #ffffff;">بوليصة شحن</div>
                <div style="font-size: 6.5px; font-weight: 700; letter-spacing: 1.5px; color: #ffffff; margin-top: 2px;">SHIPPING WAYBILL</div>
              </div>
              <!-- Brand (Right) -->
              <div style="display: flex; align-items: center; gap: 6px;">
                <div style="text-align: right;">
                  <div style="font-size: 16px; font-weight: 900; color: #14532d; letter-spacing: 0.5px; line-height: 1;">EMDAD</div>
                  <div style="font-size: 8px; font-weight: 700; color: #14532d; margin-top: 1px;">مستودع إمداد</div>
                </div>
                ${emdadLogoUri ? `<img src="${emdadLogoUri}" style="height: 28px; width: auto; object-fit: contain;" alt="Emdad Logo" />` : ''}
              </div>
            </div>

            <!-- ═══ INFO BAR ═══ -->
            <div style="display: flex; align-items: center; border-bottom: 1.5px solid #14532d; border-radius: 4px; overflow: hidden;">
              <div style="flex: 1; padding: 3px; border-left: 1px solid #14532d; text-align: center; display: flex; flex-direction: column; align-items: center;">
                <div style="font-size: 6.5px; color: #166534; font-weight: 700; margin-bottom: 1px;">الناقل</div>
                ${carrierLogoHtml}
              </div>
              <div style="flex: 1; padding: 3px; border-left: 1px solid #14532d; text-align: center;">
                <div style="font-size: 6.5px; color: #166534; font-weight: 700;">رقم الطلب</div>
                <div style="font-size: 8.5px; font-weight: 900; color: #0f172a; font-family: monospace;">${data.orderNumber}</div>
              </div>
              <div style="flex: 1; padding: 3px; text-align: center;">
                <div style="font-size: 6.5px; color: #166534; font-weight: 700;">تاريخ الإصدار</div>
                <div style="font-size: 8px; font-weight: 800; color: #0f172a;">${createdFormatted}</div>
              </div>
            </div>

            <!-- ═══ TRACKING CODES ═══ -->
            <div style="display: flex; gap: 4px;">
              ${awbSection}
              ${internalSection}
            </div>

            <!-- ═══ SENDER ═══ -->
            <div style="border: 1.5px solid #14532d; border-radius: 5px; overflow: hidden;">
              <div class="section-hdr">المرسل (FROM)</div>
              <div class="section-body">
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                  <div>
                    <div style="font-size: 9px; font-weight: 900; color: #0f172a;">${data.sender.name}</div>
                    <div style="font-size: 7.5px; color: #334155; margin-top: 1px;">📍 ${data.sender.hub}</div>
                  </div>
                  ${data.sender.phone ? `<div style="font-size: 7.5px; color: #334155; text-align: left;"><span dir="ltr" style="font-family: monospace; unicode-bidi: embed;">${data.sender.phone}</span></div>` : ''}
                </div>
              </div>
            </div>

            <!-- ═══ RECIPIENT ═══ -->
            <div style="border: 1.5px solid #14532d; border-radius: 5px; overflow: hidden;">
              <div class="section-hdr">المستلم (TO)</div>
              <div class="section-body">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <div style="font-size: 9.5px; font-weight: 900; color: #0f172a;">${data.recipient.name}</div>
                  <div style="font-size: 8px; color: #0f172a;"><span dir="ltr" style="font-family: monospace; unicode-bidi: embed;">${data.recipient.phone}</span></div>
                </div>
                <div style="font-size: 7.5px; color: #334155; margin-top: 1px;">
                  📍 <strong>${data.recipient.city}</strong>${data.recipient.district ? ` - ${data.recipient.district}` : ''}
                </div>
                ${data.recipient.address ? `<div style="font-size: 7px; color: #475569; margin-top: 1px;">${data.recipient.address}</div>` : ''}
              </div>
            </div>

            <!-- ═══ NOTES ═══ -->
            ${data.recipient.instructions ? `
              <div style="border: 1.5px solid #14532d; border-radius: 5px; overflow: hidden;">
                <div class="section-hdr">ملاحظات</div>
                <div class="section-body">
                  <div style="font-size: 7.5px; color: #334155; line-height: 1.4;">${data.recipient.instructions}</div>
                </div>
              </div>
            ` : ''}

            <!-- ═══ COD (3-column table) ═══ -->
            <div style="border: 1.5px solid #14532d; border-radius: 5px; overflow: hidden;">
              <div style="display: flex;">
                <!-- COD Amount -->
                <div style="flex: 2; border-left: 1px solid #14532d;">
                  <div style="background: #14532d; color: #ffffff; padding: 3px 4px; font-size: 7px; font-weight: 700; text-align: center;">التحصيل عند الاستلام (COD)</div>
                  <div style="background: #f0fdf4; padding: 4px; text-align: center;">
                    <span style="font-size: 15px; font-weight: 900; color: #14532d;">${data.financials.codAmount.toLocaleString('en-US')}</span>
                    <span style="font-size: 9px; font-weight: 700; color: #166534; margin-right: 2px;">${data.financials.currency}</span>
                  </div>
                </div>
                <!-- Shipping Fee -->
                <div style="flex: 1; border-left: 1px solid #14532d;">
                  <div style="background: #14532d; color: #ffffff; padding: 3px 4px; font-size: 7px; font-weight: 700; text-align: center;">أجور الشحن</div>
                  <div style="background: #f0fdf4; padding: 4px; text-align: center;">
                    <div style="font-size: 9px; font-weight: 900; color: #14532d;">${data.financials.shippingFee > 0 ? `${data.financials.shippingFee} ${data.financials.currency}` : 'متضمنة'}</div>
                  </div>
                </div>
                <!-- Payment Method -->
                <div style="flex: 1;">
                  <div style="background: #14532d; color: #ffffff; padding: 3px 4px; font-size: 7px; font-weight: 700; text-align: center;">طريقة الدفع</div>
                  <div style="background: #f0fdf4; padding: 4px; text-align: center;">
                    <div style="font-size: 9px; font-weight: 900; color: #14532d;">${data.financials.paymentMethod}</div>
                  </div>
                </div>
              </div>
            </div>

            <!-- ═══ ITEMS TABLE ═══ -->
            <div>
              <div style="display: flex; justify-content: space-between; font-size: 7.5px; font-weight: 800; color: #14532d; margin-bottom: 2px;">
                <span>محتويات الشحنة</span>
                <span>إجمالي القطع: ${data.totalQuantity}</span>
              </div>
              <table class="items-table">
                <thead>
                  <tr>
                    <th style="width: 18px; text-align: center; color: #ffffff;">#</th>
                    <th style="color: #ffffff;">المنتج</th>
                    <th style="width: 65px; color: #ffffff;">الرمز (SKU)</th>
                    <th style="width: 28px; text-align: center; color: #ffffff;">الكمية</th>
                  </tr>
                </thead>
                <tbody>
                  ${data.items.slice(0, 4).map((item: any, idx: number) => `
                    <tr style="background: ${idx % 2 === 0 ? '#ffffff' : '#f0fdf4'};">
                      <td style="text-align: center; font-family: monospace;">${idx + 1}</td>
                      <td><strong>${item.name}</strong></td>
                      <td style="font-family: monospace; color: #475569; font-size: 7px;">${item.sku}</td>
                      <td style="text-align: center; font-weight: 800;">${item.quantity}</td>
                    </tr>
                  `).join('')}
                  ${data.items.length > 4 ? `
                    <tr>
                      <td colspan="4" style="text-align: center; font-weight: 700; color: #166534; font-size: 7px;">+ ${data.items.length - 4} أصناف إضافية (إجمالي: ${data.totalQuantity} قطعة)</td>
                    </tr>
                  ` : ''}
                </tbody>
              </table>
            </div>

            <!-- ═══ FOOTER ═══ -->
            <div style="display: flex; justify-content: space-between; border-top: 1px solid #bbf7d0; padding-top: 3px; font-size: 7.5px; color: #64748b;">
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
      margin: { top: '2mm', bottom: '2mm', left: '2mm', right: '2mm' },
    });

    const filename = `waybill-${data.orderNumber}.pdf`;

    return { buffer, filename };
  }

  async exportWaybillsExcel(orderIds: string[], user: AuthPrincipal): Promise<{
    buffer: Buffer;
    filename: string;
    count: number;
  }> {
    const orders = await this.prisma.omsOrder.findMany({
      where: {
        id: { in: orderIds },
        ...(user.companyId ? { companyId: user.companyId } : {}),
      },
      include: {
        company: true,
        lines: {
          include: {
            product: true,
          },
        },
        outboundOrder: true,
      },
    });

    const rows = orders.map((order: any) => ({
      'رقم الطلب': order.orderNumber,
      'تاريخ الطلب': order.createdAt.toISOString().split('T')[0],
      'اسم المستلم': order.recipientName || '—',
      'هاتف المستلم': order.recipientPhone || '—',
      'المدينة': order.city || '—',
      'الحي/المنطقة': order.district || '—',
      'العنوان': order.addressLine1 || order.destinationAddress || '—',
      'ملاحظات والتسليم': order.deliveryInstructions || order.notes || '—',
      'مبلغ COD': Number(order.codAmount ?? 0),
      'العملة': order.currency || 'USD',
      'طريقة الدفع': order.paymentMethod || 'COD',
      'أجور الشحن': Number(order.shippingFee ?? 0),
      'رقم البوليصة الداخلي': order.trackingNumber || `EMD-${order.orderNumber}`,
      'رقم التتبع لدى الناقل': order.trackingNumber || '—',
      'اسم الناقل': order.carrier || 'إمداد اكسبرس',
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'البولايص');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const filename = `waybills-export-${new Date().toISOString().split('T')[0]}.xlsx`;

    return {
      buffer,
      filename,
      count: orders.length,
    };
  }
}
