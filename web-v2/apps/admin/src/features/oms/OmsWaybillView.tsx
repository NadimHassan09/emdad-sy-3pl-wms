import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

import { OmsWaybillData } from '@/api/oms'

// ─── Color palette (2 greens only) ──────────────────────────────────────────
const G_DARK  = '#14532d';   // dark green — headers, borders, icons, badges bg
const G_LIGHT = '#f0fdf4';   // near-white green — section bodies
const G_MID   = '#166534';   // medium green — labels inside light sections
const G_MINT  = '#86efac';   // mint — icons on dark bg, certified badge bg

type Props = {
  waybill: OmsWaybillData;
  isArabic?: boolean;
};

// ─── Small helper: dark-green section header ─────────────────────────────────
function SectionHeader({ faIcon, label }: { faIcon: string; label: string }) {
  return (
    <div style={{
      background: G_DARK, color: '#fff',
      padding: '5px 10px',
      display: 'flex', alignItems: 'center', gap: '7px',
    }}>
      <i className={`fa-solid ${faIcon}`} style={{ color: '#fff', fontSize: '12px' }} aria-hidden="true" />
      <span style={{ fontWeight: 800, fontSize: '12px' }}>{label}</span>
    </div>
  );
}

// ─── Phone: always LTR ───────────────────────────────────────────────────────
function PhoneNumber({ number }: { number: string }) {
  return (
    <span
      dir="ltr"
      style={{
        fontFamily: 'monospace', fontSize: '11px',
        color: '#0f172a', display: 'inline-block',
        unicodeBidi: 'embed',
      }}
    >
      {number}
    </span>
  );
}

export function OmsWaybillView({ waybill, isArabic: _isArabic = true }: Props) {
  const [internalQr, setInternalQr] = useState('');
  const [carrierQr,  setCarrierQr]  = useState('');

  // Load Cairo font from Google Fonts
  useEffect(() => {
    if (!document.getElementById('cairo-font-waybill')) {
      const link = document.createElement('link');
      link.id = 'cairo-font-waybill';
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap';
      document.head.appendChild(link);
    }
    if (!document.getElementById('fa-waybill')) {
      const fa = document.createElement('link');
      fa.id = 'fa-waybill';
      fa.rel = 'stylesheet';
      fa.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css';
      document.head.appendChild(fa);
    }
  }, []);

  const qrOpts = { width: 220, margin: 1, color: { dark: '#0f172a', light: '#ffffff' } };

  useEffect(() => {
    const t = waybill.qrCodeData || waybill.internalWaybillNumber || waybill.orderNumber;
    if (t) QRCode.toDataURL(t, qrOpts).then(setInternalQr).catch(console.warn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waybill.qrCodeData, waybill.internalWaybillNumber, waybill.orderNumber]);

  useEffect(() => {
    if (waybill.carrierTrackingNumber) {
      QRCode.toDataURL(waybill.carrierTrackingNumber, qrOpts).then(setCarrierQr).catch(console.warn);
    } else setCarrierQr('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waybill.carrierTrackingNumber]);

  const senderName  = waybill.company.tradeName || waybill.company.name;
  const senderPhone = (waybill.sender as { name: string; phone?: string; hub: string }).phone || '';
  const created     = waybill.createdAt ? new Date(waybill.createdAt).toISOString().split('T')[0] : '';

  return (
    <div
      className="waybill-paper"
      dir="rtl"
      style={{
        background: '#fff', color: '#0f172a', fontSize: '12px', lineHeight: '1.4',
        border: `2px solid ${G_DARK}`, borderRadius: '8px',
        display: 'flex', flexDirection: 'column', gap: '0',
        fontFamily: "'Cairo', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif",
        direction: 'rtl', maxWidth: '440px', margin: '0 auto', overflow: 'hidden',
      }}
    >

      {/* ══════════════════════ HEADER ══════════════════════ */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '10px 14px', borderBottom: `2px solid ${G_DARK}`,
      }}>
        {/* Left: green badge */}
        <div style={{
          background: G_DARK, color: '#fff', borderRadius: '6px',
          padding: '7px 14px', textAlign: 'center',
        }}>
          <div style={{ fontSize: '17px', fontWeight: 900, lineHeight: 1 }}>بوليصة شحن</div>
          <div style={{ fontSize: '8px', fontWeight: 700, letterSpacing: '2px', color: '#fff', marginTop: '2px' }}>
            SHIPPING WAYBILL
          </div>
        </div>

        {/* Right: logo + EMDAD text */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '24px', fontWeight: 900, color: G_DARK, letterSpacing: '0.5px', lineHeight: 1 }}>
              EMDAD
            </div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: G_DARK }}>مستودع إمداد</div>
          </div>
          <img
            src="/emdad-logo.png"
            alt="Emdad"
            style={{ height: '40px', width: 'auto', objectFit: 'contain' }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        </div>
      </div>

      {/* ══════════════════════ INFO BAR ══════════════════════ */}
      <div style={{ display: 'flex', borderBottom: `1.5px solid ${G_DARK}` }}>
        {/* Carrier */}
        <div style={{ flex: 1.2, padding: '7px 8px', borderLeft: `1px solid ${G_DARK}`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <i className="fa-solid fa-truck-fast" style={{ color: G_DARK, fontSize: '11px' }} aria-hidden="true" />
            <span style={{ fontSize: '9px', color: G_MID, fontWeight: 700 }}>الناقل</span>
          </div>
          {waybill.carrierLogoUrl ? (
            <img
              src={waybill.carrierLogoUrl}
              alt={waybill.carrier}
              style={{ maxHeight: '28px', maxWidth: '80px', objectFit: 'contain', display: 'block' }}
              onError={(e) => {
                const img = e.target as HTMLImageElement;
                img.style.display = 'none';
                const t = document.createElement('span');
                t.style.cssText = `font-weight:800;font-size:10px;color:${G_DARK}`;
                t.textContent = waybill.carrier;
                img.parentNode?.insertBefore(t, img.nextSibling);
              }}
            />
          ) : (
            <span style={{ fontWeight: 800, fontSize: '10px', color: G_DARK }}>{waybill.carrier}</span>
          )}
        </div>
        {/* Order number */}
        <div style={{ flex: 1.3, padding: '7px 8px', borderLeft: `1px solid ${G_DARK}`, textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', marginBottom: '3px' }}>
            <i className="fa-solid fa-file-lines" style={{ color: G_DARK, fontSize: '11px' }} aria-hidden="true" />
            <span style={{ fontSize: '9px', color: G_MID, fontWeight: 700 }}>رقم الطلب</span>
          </div>
          <div style={{ fontSize: '11px', fontWeight: 900, color: '#0f172a', fontFamily: 'monospace' }}>{waybill.orderNumber}</div>
        </div>
        {/* Issue date */}
        <div style={{ flex: 1, padding: '7px 8px', textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', marginBottom: '3px' }}>
            <i className="fa-solid fa-calendar-days" style={{ color: G_DARK, fontSize: '11px' }} aria-hidden="true" />
            <span style={{ fontSize: '9px', color: G_MID, fontWeight: 700 }}>تاريخ الإصدار</span>
          </div>
          <div style={{ fontSize: '11px', fontWeight: 800, color: '#0f172a' }}>{created}</div>
        </div>
      </div>

      {/* ══════════════════════ INNER PAD ══════════════════════ */}
      <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>

        {/* ── TRACKING CODES ── */}
        <div style={{ display: 'flex', gap: '6px', alignItems: 'stretch' }}>
          <div style={{
            flex: waybill.carrierTrackingNumber && carrierQr ? 1 : 1,
            minWidth: 0,
            border: `1.5px solid ${G_DARK}`, borderRadius: '6px',
            padding: '7px', background: '#fff',
            textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center',
          }}>
            <div style={{ fontSize: '10px', fontWeight: 800, color: G_DARK, marginBottom: '4px', width: '100%', minHeight: waybill.carrierTrackingNumber && carrierQr ? '34px' : undefined }}>
              رقم بوليصة إمداد الداخلي
              <div style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: '12px', color: '#0f172a', marginTop: '4px', wordBreak: 'break-all' }}>
                {waybill.internalWaybillNumber}
              </div>
            </div>
            {internalQr
              ? <img src={internalQr} alt="QR" style={{ width: waybill.carrierTrackingNumber && carrierQr ? 110 : 140, height: waybill.carrierTrackingNumber && carrierQr ? 110 : 140, maxWidth: 140, maxHeight: 140, objectFit: 'contain', display: 'block', marginTop: 6 }} />
              : <div style={{ width: '100%', aspectRatio: '1', background: G_LIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>QR</div>
            }
          </div>

          {waybill.carrierTrackingNumber && carrierQr ? (
            <div style={{
              flex: 1, minWidth: 0, border: `1.5px solid ${G_DARK}`, borderRadius: '6px',
              padding: '7px', background: '#fff',
              textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center',
            }}>
              <div style={{ fontSize: '10px', fontWeight: 800, color: '#0f172a', marginBottom: '3px', width: '100%', minHeight: '34px' }}>
                رقم التتبع لدى الناقل (AWB)
                {waybill.isCarrierAwbFromApi && (
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                    background: G_LIGHT, color: G_DARK,
                    border: `1px solid #86efac`, borderRadius: '4px',
                    padding: '2px 7px', fontSize: '9px', fontWeight: 800, marginTop: '3px',
                  }}>
                    <i className="fa-solid fa-circle-check" style={{ fontSize: '9px' }} aria-hidden="true" />
                    معتمد من {waybill.carrier}
                  </div>
                )}
                <div style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: '10px', color: '#0f172a', marginTop: '4px', wordBreak: 'break-all' }}>
                  {waybill.carrierTrackingNumber}
                </div>
              </div>
              <img src={carrierQr} alt="QR" style={{ width: 110, height: 110, objectFit: 'contain', display: 'block', marginTop: 6 }} />
            </div>
          ) : (
            <div style={{
              flex: '0 0 72px', width: '72px', border: `1px dashed #bbf7d0`, borderRadius: '6px',
              padding: '6px', background: G_LIGHT,
              textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{ fontSize: '10px', fontWeight: 800, color: G_DARK }}>
                {waybill.shippingMethod === 'carrier' ? 'بانتظار الإصدار' : 'شحن يدوي'}
              </div>
            </div>
          )}
        </div>

        {/* ── SENDER ── */}
        <div style={{ border: `1.5px solid ${G_DARK}`, borderRadius: '6px', overflow: 'hidden' }}>
          <SectionHeader faIcon="fa-box-open" label="المرسل (FROM)" />
          <div style={{ background: G_LIGHT, padding: '7px 10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ fontSize: '13px', fontWeight: 900, color: '#0f172a' }}>{senderName}</div>
            {senderPhone && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <i className="fa-solid fa-phone" style={{ color: G_DARK, fontSize: '11px', flexShrink: 0 }} aria-hidden="true" />
                <PhoneNumber number={senderPhone} />
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
              <i className="fa-solid fa-location-dot" style={{ color: G_DARK, fontSize: '11px', marginTop: '1px', flexShrink: 0 }} aria-hidden="true" />
              <span style={{ fontSize: '11px', color: '#334155' }}>{waybill.sender.hub}</span>
            </div>
          </div>
        </div>

        {/* ── RECIPIENT ── */}
        <div style={{ border: `1.5px solid ${G_DARK}`, borderRadius: '6px', overflow: 'hidden' }}>
          <SectionHeader faIcon="fa-user" label="المستلم (TO)" />
          <div style={{ background: G_LIGHT, padding: '7px 10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ fontSize: '13px', fontWeight: 900, color: '#0f172a' }}>{waybill.recipient.name}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <i className="fa-solid fa-phone" style={{ color: G_DARK, fontSize: '11px', flexShrink: 0 }} aria-hidden="true" />
              <PhoneNumber number={waybill.recipient.phone} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <i className="fa-solid fa-location-dot" style={{ color: G_DARK, fontSize: '11px', flexShrink: 0 }} aria-hidden="true" />
              <span style={{ fontSize: '11px', color: '#334155' }}>
                <strong>{waybill.recipient.city}</strong>
                {waybill.recipient.district ? ` - ${waybill.recipient.district}` : ''}
              </span>
            </div>
            {waybill.recipient.address && (
              <div style={{ fontSize: '10px', color: '#475569', paddingRight: '17px' }}>{waybill.recipient.address}</div>
            )}
          </div>
        </div>

        {/* ── NOTES ── */}
        {waybill.recipient.instructions && (
          <div style={{ border: `1.5px solid ${G_DARK}`, borderRadius: '6px', overflow: 'hidden' }}>
            <SectionHeader faIcon="fa-file-lines" label="ملاحظات" />
            <div style={{ background: G_LIGHT, padding: '7px 10px' }}>
              <div style={{ fontSize: '11px', color: '#334155', lineHeight: 1.5 }}>{waybill.recipient.instructions}</div>
            </div>
          </div>
        )}

        {/* ── COD — 3-column table ── */}
        <div style={{ border: `2px solid ${G_DARK}`, borderRadius: '6px', overflow: 'hidden' }}>
          <div style={{ display: 'flex' }}>
            {/* COD amount */}
            <div style={{ flex: 2, borderLeft: `1px solid ${G_DARK}` }}>
              <div style={{ background: G_DARK, color: '#fff', padding: '5px 8px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <i className="fa-solid fa-layer-group" style={{ color: '#fff', fontSize: '11px' }} aria-hidden="true" />
                <span style={{ fontSize: '9px', fontWeight: 700 }}>التحصيل عند الاستلام (COD)</span>
              </div>
              <div style={{ background: G_LIGHT, padding: '6px 10px', display: 'flex', alignItems: 'baseline', gap: '4px', justifyContent: 'center', textAlign: 'center' as const }}>
                <span style={{ fontSize: '22px', fontWeight: 900, color: G_DARK }}>{waybill.financials.codAmount.toLocaleString('en-US')}</span>
                <span style={{ fontSize: '12px', fontWeight: 700, color: G_MID }}>{waybill.financials.currency}</span>
              </div>
            </div>
            {/* Shipping fee */}
            <div style={{ flex: 1, borderLeft: `1px solid ${G_DARK}` }}>
              <div style={{ background: G_DARK, color: '#fff', padding: '5px 8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
                <i className="fa-solid fa-truck" style={{ color: '#fff', fontSize: '11px' }} aria-hidden="true" />
                <span style={{ fontSize: '9px', fontWeight: 700 }}>أجور الشحن</span>
              </div>
              <div style={{ background: G_LIGHT, padding: '6px 8px', textAlign: 'center' }}>
                <div style={{ fontSize: '13px', fontWeight: 900, color: G_DARK }}>
                  {waybill.financials.shippingFee > 0
                    ? `${waybill.financials.shippingFee} ${waybill.financials.currency}`
                    : 'متضمنة'}
                </div>
              </div>
            </div>
            {/* Payment method */}
            <div style={{ flex: 1 }}>
              <div style={{ background: G_DARK, color: '#fff', padding: '5px 8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
                <i className="fa-solid fa-credit-card" style={{ color: '#fff', fontSize: '11px' }} aria-hidden="true" />
                <span style={{ fontSize: '9px', fontWeight: 700 }}>طريقة الدفع</span>
              </div>
              <div style={{ background: G_LIGHT, padding: '6px 8px', textAlign: 'center' }}>
                <div style={{ fontSize: '13px', fontWeight: 900, color: G_DARK, textAlign: 'center' as const }}>{waybill.financials.paymentMethod}</div>
              </div>
            </div>
          </div>
        </div>

        {/* ── ITEMS TABLE ── */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', fontWeight: 800, color: G_DARK, marginBottom: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <i className="fa-solid fa-box" style={{ color: G_DARK, fontSize: '12px' }} aria-hidden="true" />
              <span>محتويات الشحنة</span>
            </div>
            <span>إجمالي القطع : {waybill.totalQuantity}</span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
            <thead>
              <tr style={{ background: G_DARK, color: '#fff' }}>
                <th style={{ border: `1px solid ${G_DARK}`, padding: '4px', textAlign: 'center', width: '24px', fontSize: '10px' }}>#</th>
                <th style={{ border: `1px solid ${G_DARK}`, padding: '4px', textAlign: 'right', fontSize: '10px' }}>المنتج</th>
                <th style={{ border: `1px solid ${G_DARK}`, padding: '4px', textAlign: 'right', width: '90px', fontSize: '10px' }}>الرمز (SKU)</th>
                <th style={{ border: `1px solid ${G_DARK}`, padding: '4px', textAlign: 'center', width: '36px', fontSize: '10px' }}>الكمية</th>
              </tr>
            </thead>
            <tbody>
              {waybill.items.slice(0, 4).map((item, idx) => (
                <tr key={item.id || idx} style={{ background: idx % 2 === 0 ? '#fff' : G_LIGHT }}>
                  <td style={{ border: '1px solid #e2e8f0', padding: '4px', textAlign: 'center', fontFamily: 'monospace' }}>{idx + 1}</td>
                  <td style={{ border: '1px solid #e2e8f0', padding: '4px' }}><strong>{item.name}</strong></td>
                  <td style={{ border: '1px solid #e2e8f0', padding: '4px', fontFamily: 'monospace', color: '#475569', fontSize: '10px' }}>{item.sku}</td>
                  <td style={{ border: '1px solid #e2e8f0', padding: '4px', textAlign: 'center', fontWeight: 800 }}>{item.quantity}</td>
                </tr>
              ))}
              {waybill.items.length > 4 && (
                <tr>
                  <td colSpan={4} style={{ border: '1px solid #e2e8f0', padding: '4px', textAlign: 'center', fontWeight: 700, color: G_MID, fontSize: '10px' }}>
                    + {waybill.items.length - 4} أصناف إضافية (إجمالي: {waybill.totalQuantity} قطعة)
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ── FOOTER ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `1.5px solid #bbf7d0`, paddingTop: '6px', fontSize: '10px', color: '#64748b' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <i className="fa-solid fa-pen-line" style={{ color: G_DARK, fontSize: '11px' }} aria-hidden="true" />
            <span>توقيع المستلم: ____________________</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <i className="fa-solid fa-calendar-check" style={{ color: G_DARK, fontSize: '11px' }} aria-hidden="true" />
            <span>تاريخ الاستلام: ____ / ____ / 202_</span>
          </div>
        </div>

      </div>
    </div>
  );
}
