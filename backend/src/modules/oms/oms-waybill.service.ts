import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PdfService } from '../../pdf/pdf.service';
import { AuthPrincipal } from '../../common/auth/current-user.types';
import { OmsWaybillData, OmsWaybillItem } from './oms-order.types';
import { PDFDocument } from 'pdf-lib';
import * as XLSX from 'xlsx';

import { shippingLabelReadiness } from './oms-label-ready';
import { fontFace as cairoFontFace } from './oms-instruction-sheet';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const QRCode = require('qrcode');

async function qrCodePngDataUri(text: string): Promise<string> {
  if (!text) return '';
  try {
    return await QRCode.toDataURL(text, {
      margin: 0,
      width: 320,
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
    // Prefer courier-facing tracking (carrierShipment.trackingNumber), not platform barcode alone.
    let carrierTrackingNumber =
      carrierShipment?.trackingNumber?.trim() ||
      order.trackingNumber?.trim() ||
      order.outboundOrder?.trackingNumber?.trim() ||
      undefined;

    if (carrierShipment) {
      carrierName = (carrierShipment as any).provider?.name || carrierShipment.providerCode || 'شركة شحن';
      carrierLogoUrl = undefined;
      isCarrierAwbFromApi = Boolean(
        carrierTrackingNumber &&
          (carrierShipment.trackingNumber === carrierTrackingNumber ||
            carrierShipment.externalAwb === carrierTrackingNumber),
      );
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

    const origin = await this.prisma.shippingOriginAddress.findUnique({
      where: { id: 'default' },
    });
    const hub = origin
      ? [origin.street, origin.district, origin.city].filter((part) => part && part.trim()).join('، ')
      : 'مستودع إمداد — حلب';

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
        hub,
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
    const html = await this.labelHtml(data);
    const buffer = await this.pdfService.renderHtml(html, {
      width: '100mm',
      height: '150mm',
      margin: { top: '0', bottom: '0', left: '0', right: '0' },
      preferCSSPageSize: true,
    });
    return { buffer, filename: `waybill-${data.orderNumber}.pdf` };
  }

  async labelHtml(data: OmsWaybillData): Promise<string> {
    const internalQrUri = await qrCodePngDataUri(data.qrCodeData);
    const carrierQrUri = data.carrierTrackingNumber
      ? await qrCodePngDataUri(data.carrierTrackingNumber)
      : '';

    const createdFormatted = new Date(data.createdAt).toISOString().split('T')[0];
    const emdadLogoUri = this.pdfService.logo;

    const icon = (path: string) =>
      `<svg viewBox="0 0 24 24" width="10" height="10" fill="#14532d" aria-hidden="true" style="flex-shrink:0;display:block;">${path}</svg>`;
    const iconOnDark = (path: string) =>
      `<svg viewBox="0 0 24 24" width="9" height="9" fill="#ffffff" aria-hidden="true" style="flex-shrink:0;display:block;">${path}</svg>`;
    const svg = {
      truck: icon('<path d="M3 7h11v8H3V7zm11 2h3.2L20 12.2V15h-6V9zM6.5 18a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zm10 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z"/>'),
      file: icon('<path d="M6 2h8l4 4v16H6V2zm8 1.5V7h3.5L14 3.5zM8 11h8v1.5H8V11zm0 3h8v1.5H8V14zm0 3h5v1.5H8V17z"/>'),
      calendar: icon('<path d="M7 2h2v2h6V2h2v2h3v18H4V4h3V2zm11 8H6v10h12V10z"/>'),
      clock: `<svg viewBox="0 0 24 24" width="18" height="18" fill="#14532d" aria-hidden="true"><path d="M12 2a10 10 0 1 0 .01 20.01A10 10 0 0 0 12 2zm1 5v4.6l3.2 1.9-1 1.6L11 12.6V7h2z"/></svg>`,
      box: icon('<path d="M12 2 3 7v10l9 5 9-5V7l-9-5zm0 2.3 6.2 3.4L12 11.2 5.8 7.7 12 4.3zM5 9.4l6 3.4v7.6l-6-3.3V9.4zm14 0v7.7l-6 3.3v-7.6l6-3.4z"/>'),
      user: iconOnDark('<path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4zm0 2c-3.3 0-8 1.7-8 5v2h16v-2c0-3.3-4.7-5-8-5z"/>'),
      pin: icon('<path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 14.5 9 2.5 2.5 0 0 1 12 11.5z"/>'),
      phone: icon('<path d="M6.6 3.2c.4-.4 1-.6 1.6-.4l2.1.7c.6.2 1 .8.9 1.4l-.3 2.2a1.3 1.3 0 0 1-.8 1l-1.2.5a11 11 0 0 0 5.5 5.5l.5-1.2c.2-.4.6-.7 1-.8l2.2-.3c.6-.1 1.2.3 1.4.9l.7 2.1c.2.6 0 1.2-.4 1.6l-1.5 1.5c-.4.4-1 .6-1.6.5C9.4 19.8 4.2 14.6 3.5 6.8c-.1-.6.1-1.2.5-1.6l1.6-2z"/>'),
      layers: iconOnDark('<path d="M12 2 2 7l10 5 10-5-10-5zm8 8.2-8 4-8-4V13l8 4 8-4V10.2zM4 15.2l8 4 8-4V18l-8 4-8-4v-2.8z"/>'),
      truckSm: iconOnDark('<path d="M3 7h11v8H3V7zm11 2h3.2L20 12.2V15h-6V9zM6.5 18a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zm10 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z"/>'),
      card: iconOnDark('<path d="M3 6h18v12H3V6zm2 3v2h14V9H5zm0 5h6v2H5v-2z"/>'),
      boxOpen: iconOnDark('<path d="M12 2 3 7v2l9 5 9-5V7L12 2zm0 2.2 6 3.3-6 3.3-6-3.3 6-3.3zM4 11.2V17l8 4.5 8-4.5v-5.8l-8 4.4-8-4.4z"/>'),
    };

    const carrierLogoHtml = data.carrierLogoUrl
      ? `<img src="${data.carrierLogoUrl}" style="max-height: 22px; max-width: 70px; object-fit: contain; display: block;" />`
      : `<span style="font-weight: 800; font-size: 8.5px; color: #14532d;">${data.carrier}</span>`;

    const hasCarrierQr = Boolean(data.carrierTrackingNumber && carrierQrUri);
    const singleSku = data.items.length <= 1;
    const internalSection = `
      <div class="qr-card">
        <div class="qr-head">
          <div class="qr-title">رقم بوليصة إمداد الداخلي</div>
          <div class="qr-number">${data.internalWaybillNumber}</div>
        </div>
        <div class="qr-slot">${internalQrUri ? `<img src="${internalQrUri}" alt="QR" />` : ''}</div>
      </div>
    `;
    const awbSection = hasCarrierQr
      ? `
        <div class="qr-card">
          <div class="qr-head">
            <div class="qr-title">رقم التتبع لدى الناقل (AWB)</div>
            <div class="qr-number">${data.carrierTrackingNumber}</div>
          </div>
          <div class="qr-slot"><img src="${carrierQrUri}" alt="QR" /></div>
        </div>
      `
      : data.shippingMethod === 'carrier'
        ? `
        <div class="qr-card qr-placeholder">
          <div class="manual-fill">
            <div class="manual-ar">بانتظار رقم الناقل</div>
            <div class="manual-en">Awaiting carrier QR</div>
          </div>
        </div>
      `
        : `
        <div class="qr-card qr-placeholder">
          <div class="manual-fill">
            <div class="manual-ar">شحن يدوي</div>
            <div class="manual-en">Manual Shipping</div>
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
            ${cairoFontFace}
            @page { size: 100mm 150mm; margin: 0; }
            * { box-sizing: border-box; margin: 0; padding: 0; }
            html, body {
              width: 100mm; height: 150mm;
              background: #fff; color: #0f172a;
              font-family: 'Cairo', Tahoma, "Segoe UI", sans-serif;
              font-size: ${singleSku ? '9.5px' : '10px'}; line-height: 1.25;
              -webkit-print-color-adjust: exact; print-color-adjust: exact;
              overflow: hidden;
            }
            .waybill {
              width: 100mm; height: 150mm;
              border: 1.5px solid #14532d; border-radius: 4px;
              padding: ${singleSku ? '2mm' : '1.6mm'}; background: #fff;
              display: flex; flex-direction: column;
              gap: ${singleSku ? '2.2mm' : '1.5mm'};
              overflow: hidden;
            }
            .section-hdr {
              background: #14532d; color: #ffffff;
              padding: 1mm 1.8mm; font-weight: 800; font-size: 9px;
              display: flex; align-items: center; gap: 1.2mm;
            }
            .section-body { background: #f0fdf4; padding: ${singleSku ? '1.4mm 1.8mm' : '1.2mm 1.6mm'}; font-size: 9.5px; }
            .qr-row { flex: 0 0 auto; display: flex; align-items: stretch; gap: 1.6mm; }
            .qr-row .qr-card { flex: 1 1 0; height: ${singleSku ? '34mm' : '32mm'}; }
            .qr-card {
              display: flex; flex-direction: column; align-items: center;
              border: 1.5px solid #14532d; border-radius: 4px; padding: 1mm;
              background: #fff; text-align: center; min-width: 0;
            }
            .qr-card.qr-placeholder { border-style: dashed; background: #f0fdf4; justify-content: center; }
            .qr-title { font-size: 8px; font-weight: 800; color: #14532d; line-height: 1.1; }
            .qr-number { font-family: monospace; font-weight: 900; font-size: 7.5px; color: #0f172a; margin-top: 0.2mm; word-break: break-all; }
            .qr-head {
              width: 100%; flex: 0 0 auto;
              display: flex; flex-direction: column; align-items: center; justify-content: flex-start;
              min-height: 6.5mm;
            }
            .qr-slot {
              flex: 1 1 auto; width: 100%;
              display: flex; align-items: center; justify-content: center;
            }
            .qr-slot img { width: 24mm; height: 24mm; object-fit: contain; display: block; }
            .manual-fill {
              width: 100%; height: 100%;
              display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1.5mm;
              padding: 2mm;
            }
            .manual-ar { font-size: 16px; font-weight: 900; color: #14532d; line-height: 1.15; }
            .manual-en { font-size: 12px; font-weight: 800; color: #166534; line-height: 1.15; }
            .name-row { display: flex; flex-wrap: wrap; align-items: center; gap: 2mm; }
            .name-row .phone { direction: ltr; unicode-bidi: embed; font-family: monospace; font-weight: 700; }
            .items { flex: 0 1 auto; min-height: 0; overflow: hidden; }
            table.items-table { width: 100%; border-collapse: collapse; font-size: ${singleSku ? '9.5px' : '9.5px'}; }
            table.items-table th, table.items-table td { border: 1px solid #cbd5e1; padding: ${singleSku ? '1.2mm 1.2mm' : '0.8mm 1mm'}; text-align: right; }
            table.items-table th { background: #14532d; color: #ffffff; font-weight: 800; font-size: 8px; text-align: center; }
            .footer-row {
              flex: 0 0 auto; margin-top: auto;
              display: flex; justify-content: space-between; align-items: center;
              border-top: 1px solid #bbf7d0; padding-top: 1.2mm; font-size: 8px; color: #64748b;
            }
          </style>
        </head>
        <body>
          <div class="waybill">

            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #14532d; padding-bottom: 1mm; flex: 0 0 auto;">
              <div style="background: #14532d; color: #ffffff; border-radius: 4px; padding: 1.2mm 2.5mm; text-align: center;">
                <div style="font-size: 13px; font-weight: 900; line-height: 1; color: #ffffff;">بوليصة شحن</div>
                <div style="font-size: 7px; font-weight: 700; letter-spacing: 1px; color: #ffffff; margin-top: 0.6mm;">SHIPPING WAYBILL</div>
              </div>
              <div style="display: flex; align-items: center; gap: 2mm;">
                <div style="text-align: right;">
                  <div style="font-size: 16px; font-weight: 900; color: #14532d; letter-spacing: 0.4px; line-height: 1;">EMDAD</div>
                  <div style="font-size: 8px; font-weight: 700; color: #14532d; margin-top: 0.4mm;">مستودع إمداد</div>
                </div>
                ${emdadLogoUri ? `<img src="${emdadLogoUri}" style="height: 9mm; width: auto; object-fit: contain;" alt="Emdad Logo" />` : ''}
              </div>
            </div>

            <div style="display: flex; align-items: stretch; border-bottom: 1.5px solid #14532d; flex: 0 0 auto;">
              <div style="flex: 1.2; padding: 0.8mm; border-left: 1px solid #14532d; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.6mm;">
                <div style="display: flex; align-items: center; gap: 1mm; font-size: 8px; color: #166534; font-weight: 700;">${svg.truck}<span>الناقل</span></div>
                ${carrierLogoHtml}
              </div>
              <div style="flex: 1.3; padding: 0.8mm; border-left: 1px solid #14532d; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center;">
                <div style="display: flex; align-items: center; gap: 1mm; font-size: 8px; color: #166534; font-weight: 700; margin-bottom: 0.4mm;">${svg.file}<span>رقم الطلب</span></div>
                <div style="font-size: 10px; font-weight: 900; color: #0f172a; font-family: monospace;">${data.orderNumber}</div>
              </div>
              <div style="flex: 1; padding: 0.8mm; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center;">
                <div style="display: flex; align-items: center; gap: 1mm; font-size: 8px; color: #166534; font-weight: 700; margin-bottom: 0.4mm;">${svg.calendar}<span>تاريخ الإصدار</span></div>
                <div style="font-size: 9.5px; font-weight: 800; color: #0f172a;">${createdFormatted}</div>
              </div>
            </div>

            <!-- ═══ TRACKING CODES ═══ -->
            <div class="qr-row">
              ${internalSection}
              ${awbSection}
            </div>

            <!-- ═══ SENDER ═══ -->
            <div style="border: 1.5px solid #14532d; border-radius: 4px; overflow: hidden;">
              <div class="section-hdr">${svg.boxOpen}<span>المرسل (FROM)</span></div>
              <div class="section-body">
                <div class="name-row">
                  <span style="font-size: 11px; font-weight: 900; color: #0f172a;">${data.sender.name}</span>
                  ${data.sender.phone ? `<span style="display:inline-flex;align-items:center;gap:1mm;font-size:10px;color:#0f172a;">${svg.phone}<span class="phone">${data.sender.phone}</span></span>` : ''}
                </div>
                <div style="display: flex; align-items: flex-start; gap: 1.2mm; margin-top: 0.5mm; font-size: 9.5px; color: #334155;">${svg.pin}<span>${data.sender.hub}</span></div>
              </div>
            </div>

            <!-- ═══ RECIPIENT ═══ -->
            <div style="border: 1.5px solid #14532d; border-radius: 4px; overflow: hidden;">
              <div class="section-hdr">${svg.user}<span>المستلم (TO)</span></div>
              <div class="section-body">
                <div class="name-row">
                  <span style="font-size: 11.5px; font-weight: 900; color: #0f172a;">${data.recipient.name}</span>
                  <span style="display:inline-flex;align-items:center;gap:1mm;font-size:10px;color:#0f172a;">${svg.phone}<span class="phone">${data.recipient.phone}</span></span>
                </div>
                <div style="display: flex; align-items: center; gap: 1.2mm; margin-top: 0.5mm; font-size: 9.5px; color: #334155;">
                  ${svg.pin}<span><strong>${data.recipient.city}</strong>${data.recipient.district ? ` - ${data.recipient.district}` : ''}</span>
                </div>
                ${data.recipient.address ? `<div style="font-size: 9px; color: #475569; margin-top: 0.4mm; padding-right: 4mm;">${data.recipient.address}</div>` : ''}
              </div>
            </div>

            <!-- ═══ NOTES ═══ -->
            ${data.recipient.instructions ? `
              <div style="border: 1.5px solid #14532d; border-radius: 4px; overflow: hidden;">
                <div class="section-hdr"><span>ملاحظات</span></div>
                <div class="section-body">
                  <div style="font-size: 7.5px; color: #334155; line-height: 1.3;">${data.recipient.instructions}</div>
                </div>
              </div>
            ` : ''}

            <!-- ═══ COD (3-column table) ═══ -->
            <div style="border: 1.5px solid #14532d; border-radius: 4px; overflow: hidden; flex: 0 0 auto;">
              <div style="display: flex;">
                <div style="flex: 2; border-left: 1px solid #14532d;">
                  <div style="background: #14532d; color: #ffffff; padding: 1.1mm; font-size: 8.5px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 1mm;">${svg.layers}<span>التحصيل عند الاستلام (COD)</span></div>
                  <div style="background: #f0fdf4; padding: 1.1mm; text-align: center;">
                    <span style="font-size: 15px; font-weight: 900; color: #14532d;">${data.financials.codAmount.toLocaleString('en-US')}</span>
                    <span style="font-size: 10px; font-weight: 700; color: #166534; margin-right: 1mm;">${data.financials.currency}</span>
                  </div>
                </div>
                <div style="flex: 1; border-left: 1px solid #14532d;">
                  <div style="background: #14532d; color: #ffffff; padding: 1.1mm; font-size: 8.5px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 1mm;">${svg.truckSm}<span>أجور الشحن</span></div>
                  <div style="background: #f0fdf4; padding: 1.1mm; text-align: center;">
                    <div style="font-size: 11px; font-weight: 900; color: #14532d;">${data.financials.shippingFee > 0 ? `${data.financials.shippingFee} ${data.financials.currency}` : 'متضمنة'}</div>
                  </div>
                </div>
                <div style="flex: 1;">
                  <div style="background: #14532d; color: #ffffff; padding: 1.1mm; font-size: 8.5px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 1mm;">${svg.card}<span>طريقة الدفع</span></div>
                  <div style="background: #f0fdf4; padding: 1.1mm; text-align: center;">
                    <div style="font-size: 11px; font-weight: 900; color: #14532d;">${data.financials.paymentMethod}</div>
                  </div>
                </div>
              </div>
            </div>

            <!-- ═══ ITEMS TABLE ═══ -->
            <div class="items">
              <div style="display: flex; justify-content: space-between; align-items: center; font-size: 10px; font-weight: 800; color: #14532d; margin-bottom: 0.6mm;">
                <span style="display: flex; align-items: center; gap: 1mm;">${svg.box}<span>محتويات الشحنة</span></span>
                <span>إجمالي القطع : ${data.totalQuantity}</span>
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
                  ${data.items.map((item: any, idx: number) => `
                    <tr style="background: ${idx % 2 === 0 ? '#ffffff' : '#f0fdf4'};">
                      <td style="text-align: center; font-family: monospace;">${idx + 1}</td>
                      <td><strong>${item.name}</strong></td>
                      <td style="font-family: monospace; color: #475569; font-size: 9px;">${item.sku}</td>
                      <td style="text-align: center; font-weight: 800;">${item.quantity}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>

            <!-- ═══ FOOTER ═══ -->
            <div class="footer-row">
              <div style="display: flex; align-items: center; gap: 3px;">${svg.file}<span>توقيع المستلم: ____________________</span></div>
              <div style="display: flex; align-items: center; gap: 3px;">${svg.calendar}<span>تاريخ الاستلام: ____ / ____ / 202_</span></div>
            </div>

          </div>
        </body>
      </html>
    `;

    return html;
  }

  /** One PDF, one label page per confirmed order, in the batch order that was requested. Page size stays 100×150 mm. */
  async generateCombinedWaybillPdf(
    orderIds: string[],
    user: AuthPrincipal,
  ): Promise<{ buffer: Buffer; filename: string; count: number }> {
    const unique = [...new Set(orderIds.map((id) => id.trim()).filter(Boolean))].slice(0, 500);
    const orders = await this.prisma.omsOrder.findMany({
      where: {
        id: { in: unique },
        ...(user.companyId ? { companyId: user.companyId } : {}),
      },
      include: {
        outboundOrder: { include: { carrierShipments: true } },
      },
    });
    const position = new Map(unique.map((orderId, index) => [orderId, index]));
    const ready = orders
      .filter((order) => {
        const outbound = order.outboundOrder;
        const created = outbound?.carrierShipments?.find((shipment) => shipment.status === 'created');
        return (
          shippingLabelReadiness({
            status: order.status,
            outboundStatus: outbound?.status,
            trackingNumber:
              order.trackingNumber ??
              outbound?.trackingNumber ??
              created?.trackingNumber ??
              created?.externalAwb,
            hasCreatedCarrierShipment: Boolean(created),
          }) !== 'not_confirmed'
        );
      })
      .sort((left, right) => (position.get(left.id) ?? 0) - (position.get(right.id) ?? 0));
    if (ready.length === 0) {
      throw new BadRequestException('No shipping labels are available for the selected orders.');
    }

    const merged = await PDFDocument.create();
    for (const order of ready) {
      const { buffer } = await this.generateWaybillPdf(order.id, user);
      const source = await PDFDocument.load(buffer);
      const pages = await merged.copyPages(source, source.getPageIndices());
      for (const page of pages) merged.addPage(page);
    }
    return {
      buffer: Buffer.from(await merged.save()),
      filename: `shipping-labels-${ready.length}.pdf`,
      count: ready.length,
    };
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
