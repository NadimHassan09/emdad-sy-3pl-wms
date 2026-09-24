import { useEffect, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';

import { OmsWaybillData } from '../../api/oms';

type Props = {
  waybill: OmsWaybillData;
  isArabic?: boolean;
};

export function OmsWaybillView({ waybill, isArabic = true }: Props) {
  const internalBarcodeSvgRef = useRef<SVGSVGElement>(null);
  const carrierBarcodeSvgRef = useRef<SVGSVGElement>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');

  // Generate internal barcode
  useEffect(() => {
    if (internalBarcodeSvgRef.current && waybill.internalWaybillNumber) {
      try {
        JsBarcode(internalBarcodeSvgRef.current, waybill.internalWaybillNumber, {
          format: 'CODE128',
          width: 1.7,
          height: 42,
          displayValue: false,
          margin: 0,
        });
      } catch (err) {
        console.warn('Internal barcode rendering error:', err);
      }
    }
  }, [waybill.internalWaybillNumber]);

  // Generate carrier barcode (only when carrier AWB exists from API)
  useEffect(() => {
    if (carrierBarcodeSvgRef.current && waybill.carrierTrackingNumber) {
      try {
        JsBarcode(carrierBarcodeSvgRef.current, waybill.carrierTrackingNumber, {
          format: 'CODE128',
          width: 1.7,
          height: 42,
          displayValue: false,
          margin: 0,
        });
      } catch (err) {
        console.warn('Carrier barcode rendering error:', err);
      }
    }
  }, [waybill.carrierTrackingNumber]);

  // Generate QR Code for internal waybill number with comfortable padding
  useEffect(() => {
    const textToEncode = waybill.qrCodeData || waybill.internalWaybillNumber || waybill.orderNumber;
    if (textToEncode) {
      QRCode.toDataURL(textToEncode, {
        width: 140,
        margin: 1,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      })
        .then((url) => setQrCodeDataUrl(url))
        .catch((err) => console.warn('QR Code generation error:', err));
    }
  }, [waybill.qrCodeData, waybill.internalWaybillNumber, waybill.orderNumber]);

  const createdDate = waybill.createdAt
    ? new Date(waybill.createdAt).toLocaleDateString(isArabic ? 'ar-SY' : 'en-GB')
    : '';

  return (
    <div
      className="waybill-paper mx-auto w-full max-w-2xl rounded-xl border-2 border-slate-900 bg-white p-6 text-slate-900 shadow-sm text-xs leading-relaxed print:max-w-none print:w-full print:border-[1.5px] print:p-2.5 print:rounded-none print:shadow-none print:text-[8px] print:leading-tight"
      dir={isArabic ? 'rtl' : 'ltr'}
    >
      {/* 1. Header: EMDAD Full Logistics Services + Real Carrier Logo / Badge */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-slate-900 pb-3.5 mb-4 print:border-b-[1.5px] print:pb-1.5 print:mb-1.5 print:gap-1">
        <div className="space-y-1 print:space-y-0.5">
          <div className="flex flex-wrap items-baseline gap-2 print:gap-1">
            <h2 className="font-black text-base tracking-tight text-slate-950 uppercase print:text-[11px] print:tracking-normal">
              EMDAD LOGISTICS SERVICES
            </h2>
            <span className="text-xs font-bold text-slate-600 print:text-[8px]">
              إمداد للخدمات اللوجستية
            </span>
          </div>
          <p className="text-[11px] text-slate-500 font-medium print:text-[7px]">
            Emdad 3PL · {isArabic ? 'بوليصة الشحن المعتمدة (10×15 سم)' : 'Official Waybill (10×15 cm)'}
          </p>
          <div className="text-[11px] text-slate-700 font-medium pt-0.5 print:text-[7.5px] print:pt-0">
            {isArabic ? 'رقم الطلب:' : 'Order #:'}{' '}
            <span className="font-mono font-bold text-slate-950">{waybill.orderNumber}</span>
            {createdDate && <span> · {createdDate}</span>}
          </div>
        </div>

        {/* Real Carrier Logo & Carrier Name */}
        <div className="flex flex-col items-end">
          <div className="flex items-center gap-2 rounded-lg border-1.5 border-slate-800 bg-slate-50 px-3 py-1.5 shadow-xs print:p-1 print:border print:rounded">
            {waybill.carrierLogoUrl ? (
              <img
                src={waybill.carrierLogoUrl}
                alt={waybill.carrier}
                className="h-7 max-h-7 max-w-[110px] object-contain print:h-4 print:max-w-[70px]"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            ) : (
              <i className="fa-solid fa-truck-fast text-slate-700 text-sm print:text-[10px]" aria-hidden="true" />
            )}
            <div className="text-right">
              <span className="text-[9px] font-extrabold uppercase text-slate-500 block print:text-[6.5px]">
                {isArabic ? 'شركة الشحن' : 'Carrier'}
              </span>
              <span className="font-black text-xs text-slate-950 print:text-[8.5px]">
                {waybill.carrier}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Distinct Identifiers: Internal Waybill + Carrier AWB + QR Code */}
      <div className="grid grid-cols-1 md:grid-cols-2 print:grid-cols-2 gap-3 print:gap-1.5 mb-4 print:mb-1.5">
        {/* Left/First: Internal Waybill Number + Barcode + QR Code */}
        <div className="rounded-lg border-1.5 border-slate-900 bg-slate-50/50 p-3 flex flex-col justify-between print:rounded print:border print:p-1.5">
          <div className="text-[10px] font-black uppercase text-slate-700 tracking-wider border-b border-slate-200 pb-1.5 mb-2 flex items-center justify-between print:text-[7.5px] print:pb-0.5 print:mb-1">
            <span>{isArabic ? 'بوليصة إمداد (رقم داخلي)' : 'Internal Waybill'}</span>
            <span className="text-[9px] text-slate-500 font-bold print:text-[6.5px]">EMDAD ID</span>
          </div>

          <div className="flex items-center gap-3 print:gap-1.5">
            {/* Internal Barcode */}
            <div className="flex-1 flex flex-col items-center justify-center text-center overflow-hidden">
              <svg ref={internalBarcodeSvgRef} className="max-w-full h-10 print:h-7" />
              <div className="mt-1 font-mono text-xs font-black tracking-widest text-slate-900 select-all print:text-[8.5px] print:tracking-tight print:mt-0.5">
                {waybill.internalWaybillNumber}
              </div>
              <span className="text-[9px] text-slate-500 font-medium mt-0.5 print:text-[6.5px] print:mt-0">
                {isArabic ? 'الباركود الداخلي المعتمد' : 'System Barcode'}
              </span>
            </div>

            {/* Internal QR Code */}
            <div className="flex flex-col items-center justify-center p-1.5 bg-white rounded-lg border border-slate-300 shadow-2xs print:p-0.5 print:rounded print:border print:shrink-0">
              {qrCodeDataUrl ? (
                <img
                  src={qrCodeDataUrl}
                  alt="Internal QR Code"
                  className="w-14 h-14 object-contain print:w-9 print:h-9"
                />
              ) : (
                <div className="w-14 h-14 bg-slate-100 flex items-center justify-center text-[10px] text-slate-400 print:w-9 print:h-9 print:text-[8px]">
                  QR
                </div>
              )}
              <span className="text-[8px] font-bold text-slate-600 mt-1 uppercase tracking-wider print:text-[6px] print:mt-0.5">
                QR
              </span>
            </div>
          </div>
        </div>

        {/* Right/Second: Carrier Waybill Number from API + Barcode */}
        <div className="rounded-lg border-1.5 border-slate-900 bg-slate-50/50 p-3 flex flex-col justify-between print:rounded print:border print:p-1.5">
          <div className="text-[10px] font-black uppercase text-slate-700 tracking-wider border-b border-slate-200 pb-1.5 mb-2 flex items-center justify-between print:text-[7.5px] print:pb-0.5 print:mb-1">
            <span>{isArabic ? 'بوليصة شركة الشحن (Carrier AWB)' : 'Carrier Waybill (AWB)'}</span>
            <span className="text-[9px] font-bold text-primary print:text-[7px]">
              {waybill.carrier}
            </span>
          </div>

          {waybill.carrierTrackingNumber ? (
            <div className="flex flex-col items-center justify-center text-center py-0.5 print:py-0 overflow-hidden">
              <svg ref={carrierBarcodeSvgRef} className="max-w-full h-10 print:h-7" />
              <div className="mt-1 font-mono text-xs font-black tracking-widest text-slate-950 select-all print:text-[8.5px] print:tracking-tight print:mt-0.5">
                {waybill.carrierTrackingNumber}
              </div>
              <div className="flex items-center gap-1 text-[9px] text-emerald-700 font-bold mt-0.5 print:text-[6.5px] print:mt-0">
                <i className="fa-solid fa-circle-check text-[8px] print:text-[6px]" aria-hidden="true" />
                <span>
                  {isArabic ? 'معتمد من API الناقل' : 'Carrier API Verified'}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center py-2 px-1 border border-dashed border-slate-300 rounded-lg bg-white/70 print:py-1 print:border print:rounded">
              <i className="fa-solid fa-clock-rotate-left text-slate-400 text-sm mb-0.5 print:text-[10px]" aria-hidden="true" />
              <div className="font-bold text-xs text-slate-700 print:text-[7.5px]">
                {waybill.shippingMethod === 'carrier'
                  ? (isArabic ? 'بانتظار الإصدار من API الناقل' : 'Pending Carrier API')
                  : (isArabic ? 'شحن يدوي (بدون بوليصة إلكترونية)' : 'Manual Shipping')}
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5 print:text-[6.5px]">
                {waybill.carrier}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 3. Sender & Recipient Columns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 print:grid-cols-2 gap-3 print:gap-1.5 mb-4 print:mb-1.5">
        {/* Sender */}
        <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 space-y-1 print:rounded print:p-1.5 print:space-y-0.5">
          <div className="text-[10px] font-black uppercase text-slate-500 tracking-wider border-b border-slate-200 pb-1 mb-1 print:text-[7px] print:pb-0.5 print:mb-0.5">
            {isArabic ? 'بيانات المرسل (Sender)' : 'Sender Information'}
          </div>
          <div className="font-bold text-slate-900 text-xs print:text-[8px]">
            {waybill.company.name}
          </div>
          <div className="text-slate-600 text-[11px] print:text-[7.5px]">
            {waybill.sender.hub}
          </div>
        </div>

        {/* Recipient */}
        <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 space-y-1 print:rounded print:p-1.5 print:space-y-0.5">
          <div className="text-[10px] font-black uppercase text-slate-500 tracking-wider border-b border-slate-200 pb-1 mb-1 print:text-[7px] print:pb-0.5 print:mb-0.5">
            {isArabic ? 'بيانات المستلم (Recipient)' : 'Recipient Information'}
          </div>
          <div className="flex items-center justify-between gap-1">
            <span className="font-bold text-slate-900 text-xs print:text-[8px]">
              {waybill.recipient.name}
            </span>
            <span className="font-mono font-bold text-slate-800 text-[11px] print:text-[7.5px]">
              {waybill.recipient.phone}
            </span>
          </div>
          <div className="text-slate-800 text-[11px] font-medium print:text-[7.5px]">
            <i className="fa-solid fa-location-dot text-rose-600 me-1 print:text-[7px]" aria-hidden="true" />
            <span className="font-bold">{waybill.recipient.city}</span>
            {waybill.recipient.district ? ` - ${waybill.recipient.district}` : ''}
          </div>
          <div className="text-slate-600 text-[11px] truncate print:text-[7px]">
            {waybill.recipient.address}
          </div>
          {waybill.recipient.instructions && (
            <div className="text-amber-900 font-medium text-[10px] mt-0.5 print:text-[6.5px]">
              <span className="font-bold">{isArabic ? 'ملاحظة:' : 'Note:'}</span>{' '}
              {waybill.recipient.instructions}
            </div>
          )}
        </div>
      </div>

      {/* 4. COD & Financials */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border-2 border-slate-900 bg-slate-100 p-3 mb-4 print:border print:rounded print:p-1.5 print:mb-1.5 print:gap-1">
        <div>
          <div className="text-[10px] font-black uppercase tracking-wider text-slate-600 print:text-[7px]">
            {isArabic ? 'المبلغ المطلوب تحصيله (COD)' : 'Cash on Delivery (COD)'}
          </div>
          <div className="text-lg font-black text-slate-950 print:text-xs">
            {waybill.financials.codAmount.toLocaleString('en-US')}{' '}
            <span className="text-xs font-bold text-slate-700 print:text-[8px]">
              {waybill.financials.currency}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4 text-[11px] print:gap-2 print:text-[7.5px]">
          <div>
            <span className="text-slate-500 block text-[10px] print:text-[6.5px]">
              {isArabic ? 'أجور الشحن' : 'Shipping Fee'}
            </span>
            <span className="font-semibold text-slate-900">
              {waybill.financials.shippingFee > 0
                ? `${waybill.financials.shippingFee} ${waybill.financials.currency}`
                : (isArabic ? 'مدفوعة / متضمنة' : 'Included')}
            </span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px] print:text-[6.5px]">
              {isArabic ? 'طريقة الدفع' : 'Payment'}
            </span>
            <span className="font-semibold text-slate-900">
              {waybill.financials.paymentMethod}
            </span>
          </div>
        </div>
      </div>

      {/* 5. Line Items Table */}
      <div className="mb-4 print:mb-1">
        <div className="text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1.5 flex items-center justify-between print:text-[7px] print:mb-0.5">
          <span>{isArabic ? 'محتويات الشحنة' : 'Package Contents'}</span>
          <span>
            {isArabic ? `إجمالي القطع: ${waybill.totalQuantity}` : `Total items: ${waybill.totalQuantity}`}
          </span>
        </div>
        <table className="w-full border-collapse border border-slate-200 text-[11px] print:text-[7.5px]">
          <thead>
            <tr className="bg-slate-100 text-slate-700">
              <th className="border border-slate-300 p-1.5 text-center w-8 print:p-0.5 print:w-5">#</th>
              <th className="border border-slate-300 p-1.5 text-start print:p-0.5">
                {isArabic ? 'المنتج' : 'Product'}
              </th>
              <th className="border border-slate-300 p-1.5 text-start w-32 print:p-0.5 print:w-20">
                {isArabic ? 'الرمز (SKU)' : 'SKU'}
              </th>
              <th className="border border-slate-300 p-1.5 text-center w-16 print:p-0.5 print:w-10">
                {isArabic ? 'الكمية' : 'Qty'}
              </th>
            </tr>
          </thead>
          <tbody>
            {waybill.items.map((item, idx) => (
              <tr
                key={item.id || idx}
                className={idx >= 4 ? 'print:hidden' : ''}
              >
                <td className="border border-slate-200 p-1.5 text-center font-mono print:p-0.5">
                  {idx + 1}
                </td>
                <td className="border border-slate-200 p-1.5 font-medium print:p-0.5">
                  {item.name}
                </td>
                <td className="border border-slate-200 p-1.5 font-mono text-[10px] text-slate-600 print:p-0.5 print:text-[6.5px]">
                  {item.sku}
                </td>
                <td className="border border-slate-200 p-1.5 text-center font-bold print:p-0.5">
                  {item.quantity}
                </td>
              </tr>
            ))}
            {waybill.items.length > 4 && (
              <tr className="hidden print:table-row bg-slate-50 font-bold text-slate-600">
                <td colSpan={4} className="border border-slate-200 p-0.5 text-center text-[7px]">
                  {isArabic
                    ? `+ ${waybill.items.length - 4} أصناف إضافية (إجمالي الشحنة: ${waybill.totalQuantity} قطعة)`
                    : `+ ${waybill.items.length - 4} more items (Total: ${waybill.totalQuantity} items)`}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 6. Signatures Footer */}
      <div className="flex items-center justify-between border-t border-slate-200 pt-2.5 text-[10px] text-slate-500 print:pt-1 print:text-[7px]">
        <div>
          {isArabic ? 'توقيع المستلم:' : 'Recipient Signature:'}{' '}
          <span className="font-mono text-slate-300 print:text-slate-400">________________________</span>
        </div>
        <div>
          {isArabic ? 'تاريخ الاستلام:' : 'Delivery Date:'}{' '}
          <span className="font-mono text-slate-300 print:text-slate-400">____ / ____ / 202_</span>
        </div>
      </div>
    </div>
  );
}
