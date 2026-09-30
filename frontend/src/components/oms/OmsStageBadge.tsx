import type { ReactElement } from 'react';
import type { OmsOrderListItem } from '../../api/oms';

type Props = {
  order: OmsOrderListItem;
  isArabic?: boolean;
};

export function OmsStageBadge({ order, isArabic = false }: Props): ReactElement {
  const outboundStatus = order.linkedOutboundOrder?.status;
  const omsStatus = order.status;

  // Processing stage: color-coded by outbound sub-stage (Picking = Yellow, Packing = Green, Shipping Details = Blue)
  if (omsStatus === 'processing' || outboundStatus) {
    if (
      outboundStatus === 'picking' ||
      outboundStatus === 'draft' ||
      outboundStatus === 'allocated' ||
      outboundStatus === 'pending_approval' ||
      outboundStatus === 'confirmed' ||
      outboundStatus === 'pending_stock'
    ) {
      return (
        <span
          className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60 shadow-xs whitespace-nowrap"
          title={isArabic ? 'مرحلة الالتقاط' : 'Picking stage'}
        >
          <i className="fa-solid fa-hand-holding-box text-[11px] text-amber-600 dark:text-amber-400" aria-hidden="true" />
          <span>{isArabic ? 'التقاط' : 'Picking'}</span>
        </span>
      );
    }

    if (outboundStatus === 'packing') {
      return (
        <span
          className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60 shadow-xs whitespace-nowrap"
          title={isArabic ? 'مرحلة التعبئة والتغليف' : 'Packing stage'}
        >
          <i className="fa-solid fa-boxes-packing text-[11px] text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
          <span>{isArabic ? 'تعبئة' : 'Packing'}</span>
        </span>
      );
    }

    if (
      outboundStatus === 'waiting_for_shipping_method' ||
      outboundStatus === 'waiting_for_shipping_details'
    ) {
      const hasShipmentSent = Boolean(
        order.trackingNumber?.trim() ||
        order.linkedOutboundOrder?.trackingNumber?.trim() ||
        order.linkedOutboundOrder?.hasCarrierShipment,
      );

      if (hasShipmentSent) {
        return (
          <span
            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60 shadow-xs whitespace-nowrap"
            title={
              isArabic
                ? 'تم إرسال الشحنة لشركة الشحن - بانتظار تأكيد الشحن'
                : 'Shipment request sent to carrier - Waiting for shipping confirmation'
            }
          >
            <i className="fa-solid fa-paper-plane text-[11px] text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
            <span>{isArabic ? 'بانتظار تأكيد الشحن' : 'Waiting for Shipping Confirmation'}</span>
          </span>
        );
      }

      return (
        <span
          className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold bg-sky-50 text-sky-800 border border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800/60 shadow-xs whitespace-nowrap"
          title={isArabic ? 'مرحلة تفاصيل الشحن' : 'Shipping Details stage'}
        >
          <i className="fa-solid fa-truck-ramp-box text-[11px] text-sky-600 dark:text-sky-400" aria-hidden="true" />
          <span>{isArabic ? 'تفاصيل الشحن' : 'Shipping Details'}</span>
        </span>
      );
    }
  }

  // Stages outside processing
  if (omsStatus === 'waiting_for_confirmation') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700 shadow-xs whitespace-nowrap">
        <i className="fa-regular fa-clock text-[11px] text-slate-500" aria-hidden="true" />
        <span>{isArabic ? 'تأكيد العميل' : 'Confirmation'}</span>
      </span>
    );
  }

  if (
    omsStatus === 'confirmed_waiting_for_admin_approval' ||
    omsStatus === 'pending_approval' ||
    omsStatus === 'pending'
  ) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold bg-orange-50 text-orange-800 border border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800/60 shadow-xs whitespace-nowrap">
        <i className="fa-solid fa-stamp text-[11px] text-orange-600 dark:text-orange-400" aria-hidden="true" />
        <span>{isArabic ? 'موافقة الإدارة' : 'Admin Approval'}</span>
      </span>
    );
  }

  if (omsStatus === 'ready_to_ship' || outboundStatus === 'ready_to_ship') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold bg-violet-50 text-violet-800 border border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-800/60 shadow-xs whitespace-nowrap">
        <i className="fa-solid fa-truck-fast text-[11px] text-violet-600 dark:text-violet-400" aria-hidden="true" />
        <span>{isArabic ? 'جاهز للشحن' : 'Ready to Ship'}</span>
      </span>
    );
  }

  if (omsStatus === 'shipped' || omsStatus === 'out_for_delivery' || outboundStatus === 'shipped') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold bg-cyan-50 text-cyan-800 border border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-800/60 shadow-xs whitespace-nowrap">
        <i className="fa-solid fa-route text-[11px] text-cyan-600 dark:text-cyan-400" aria-hidden="true" />
        <span>{isArabic ? 'خرج للتسليم' : 'Out for Delivery'}</span>
      </span>
    );
  }

  if (omsStatus === 'delivered') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60 shadow-xs whitespace-nowrap">
        <i className="fa-solid fa-circle-check text-[11px] text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
        <span>{isArabic ? 'تم التسليم' : 'Delivered'}</span>
      </span>
    );
  }

  if (omsStatus === 'failed_delivery') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60 shadow-xs whitespace-nowrap">
        <i className="fa-solid fa-triangle-exclamation text-[11px] text-amber-600 dark:text-amber-400" aria-hidden="true" />
        <span>{isArabic ? 'تعذر التسليم' : 'Failed Delivery'}</span>
      </span>
    );
  }

  if (omsStatus === 'returned') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60 shadow-xs whitespace-nowrap">
        <i className="fa-solid fa-rotate-left text-[11px] text-rose-600 dark:text-rose-400" aria-hidden="true" />
        <span>{isArabic ? 'مرتجع' : 'Returned'}</span>
      </span>
    );
  }

  if (omsStatus === 'cancelled') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium bg-zinc-100 text-zinc-700 border border-zinc-200 dark:bg-zinc-800/60 dark:text-zinc-400 dark:border-zinc-700 shadow-xs whitespace-nowrap">
        <i className="fa-solid fa-ban text-[11px] text-zinc-500" aria-hidden="true" />
        <span>{isArabic ? 'ملغي' : 'Cancelled'}</span>
      </span>
    );
  }

  return <span className="text-text-muted text-xs">—</span>;
}
