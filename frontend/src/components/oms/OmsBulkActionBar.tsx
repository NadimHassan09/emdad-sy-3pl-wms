import type { OmsOrderListItem, OmsOrderStatus } from '../../api/oms';

/** OMS statuses that can be bulk-approved */
const APPROVE_ELIGIBLE: OmsOrderStatus[] = [
  'pending_approval',
  'confirmed_waiting_for_admin_approval',
  'pending',
];

/** OMS statuses where outbound order is in a processable state */
const PROCESS_ELIGIBLE_OMS: OmsOrderStatus[] = [
  'pending_approval',
  'confirmed_waiting_for_admin_approval',
  'pending',
  'confirmed',
  'approved',
];

/** Outbound statuses eligible for picking completion */
const PICKING_ELIGIBLE_OUTBOUND = ['picking'];

/** Outbound statuses eligible for packing completion */
const PACKING_ELIGIBLE_OUTBOUND = ['packing'];

/** Outbound statuses eligible for shipping details */
const SHIPPING_DETAILS_ELIGIBLE_OUTBOUND = [
  'waiting_for_shipping_method',
  'waiting_for_shipping_details',
];

type EligibilityCounts = {
  confirm: { eligible: number; total: number };
  cancel: { eligible: number; total: number };
  approve: { eligible: number; total: number };
  process: { eligible: number; total: number };
  completePicking: { eligible: number; total: number };
  completePacking: { eligible: number; total: number };
  shippingDetails: { eligible: number; total: number };
  ship: { eligible: number; total: number };
};

function computeEligibility(
  orders: OmsOrderListItem[],
): EligibilityCounts {
  let confirmEligible = 0;
  let cancelEligible = 0;
  let approveEligible = 0;
  let processEligible = 0;
  let pickingEligible = 0;
  let packingEligible = 0;
  let shippingDetailsEligible = 0;
  let shipEligible = 0;

  for (const order of orders) {
    const outboundStatus = order.linkedOutboundOrder?.status;

    if (order.status === 'waiting_for_confirmation') {
      confirmEligible++;
      cancelEligible++;
    }

    if (APPROVE_ELIGIBLE.includes(order.status)) approveEligible++;

    if (
      PROCESS_ELIGIBLE_OMS.includes(order.status) &&
      (order.outboundOrderId ?? order.linkedOutboundOrder?.id)
    )
      processEligible++;

    if (outboundStatus && PICKING_ELIGIBLE_OUTBOUND.includes(outboundStatus)) pickingEligible++;
    if (outboundStatus && PACKING_ELIGIBLE_OUTBOUND.includes(outboundStatus)) packingEligible++;
    if (
      outboundStatus &&
      SHIPPING_DETAILS_ELIGIBLE_OUTBOUND.includes(outboundStatus)
    )
      shippingDetailsEligible++;
    if (order.status === 'ready_to_ship') shipEligible++;
  }

  const total = orders.length;
  return {
    confirm: { eligible: confirmEligible, total },
    cancel: { eligible: cancelEligible, total },
    approve: { eligible: approveEligible, total },
    process: { eligible: processEligible, total },
    completePicking: { eligible: pickingEligible, total },
    completePacking: { eligible: packingEligible, total },
    shippingDetails: { eligible: shippingDetailsEligible, total },
    ship: { eligible: shipEligible, total },
  };
}

type ActionButtonProps = {
  label: string;
  icon: string;
  eligible: number;
  total: number;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'default' | 'primary';
};

function ActionButton({
  label,
  icon,
  eligible,
  total,
  onClick,
  disabled,
  loading,
  variant = 'default',
}: ActionButtonProps) {
  const ineligible = total - eligible;
  const isDisabled = disabled || loading || eligible === 0;

  return (
    <div className="flex flex-col items-center gap-0.5">
      <button
        onClick={onClick}
        disabled={isDisabled}
        id={`bulk-action-${label.toLowerCase().replace(/\s+/g, '-')}`}
        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
          variant === 'primary'
            ? 'bg-brand text-white hover:bg-brand-hover'
            : 'border border-border-base bg-surface-base text-text-strong hover:bg-surface-hover'
        }`}
      >
        {loading ? (
          <i className="fa-solid fa-spinner fa-spin text-[10px]" />
        ) : (
          <i className={`${icon} text-[10px]`} />
        )}
        {label}
        <span
          className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
            variant === 'primary'
              ? 'bg-white/20 text-white'
              : 'bg-surface-muted text-text-muted'
          }`}
        >
          {eligible}
        </span>
      </button>
      {ineligible > 0 && eligible > 0 && (
        <span className="text-[10px] text-text-faint">
          ({ineligible} will be skipped)
        </span>
      )}
    </div>
  );
}

type Props = {
  selectedOrders: OmsOrderListItem[];
  onClearSelection: () => void;
  onConfirm?: () => void;
  onCancel?: () => void;
  onApprove: () => void;
  onProcess: () => void;
  onCompletePicking: () => void;
  onCompletePacking: () => void;
  onShippingDetails: () => void;
  onShip: () => void;
  loadingAction: string | null;
};

/**
 * Sticky bulk action bar shown when ≥1 orders are selected.
 * Each button shows eligible count; ineligible are processed silently as failures.
 */
export function OmsBulkActionBar({
  selectedOrders,
  onClearSelection,
  onConfirm,
  onCancel,
  onApprove,
  onProcess,
  onCompletePicking,
  onCompletePacking,
  onShippingDetails,
  onShip,
  loadingAction,
}: Props) {
  const counts = computeEligibility(selectedOrders);

  return (
    <div
      role="toolbar"
      aria-label="Bulk actions"
      className="sticky bottom-0 z-20 mx-0 mb-0 rounded-none sm:rounded-xl border-t sm:border border-border-base bg-surface-overlay/95 backdrop-blur-sm shadow-lg px-4 py-3"
    >
      <div className="flex flex-wrap items-center gap-3">
        {/* Selection count + clear */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="rounded-full bg-brand px-2.5 py-0.5 text-xs font-semibold text-white">
            {selectedOrders.length}
          </span>
          <span className="text-sm font-medium text-text-strong">selected</span>
          <button
            onClick={onClearSelection}
            aria-label="Clear selection"
            className="ml-1 rounded p-0.5 text-text-faint hover:text-text-strong hover:bg-surface-hover transition-colors"
          >
            <i className="fa-solid fa-xmark text-xs" />
          </button>
        </div>

        <div className="h-5 w-px bg-border-base" />

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          {counts.confirm.eligible > 0 && onConfirm && (
            <ActionButton
              label="Confirm"
              icon="fa-solid fa-check-double"
              eligible={counts.confirm.eligible}
              total={counts.confirm.total}
              onClick={onConfirm}
              loading={loadingAction === 'confirm'}
              disabled={!!loadingAction}
              variant="primary"
            />
          )}
          {counts.cancel.eligible > 0 && onCancel && (
            <ActionButton
              label="Cancel"
              icon="fa-solid fa-ban"
              eligible={counts.cancel.eligible}
              total={counts.cancel.total}
              onClick={onCancel}
              loading={loadingAction === 'cancel'}
              disabled={!!loadingAction}
            />
          )}
          <ActionButton
            label="Approve"
            icon="fa-solid fa-check"
            eligible={counts.approve.eligible}
            total={counts.approve.total}
            onClick={onApprove}
            loading={loadingAction === 'approve'}
            disabled={!!loadingAction}
          />
          <ActionButton
            label="Process"
            icon="fa-solid fa-play"
            eligible={counts.process.eligible}
            total={counts.process.total}
            onClick={onProcess}
            loading={loadingAction === 'process'}
            disabled={!!loadingAction}
          />
          <ActionButton
            label="Mark Picking Complete"
            icon="fa-solid fa-box-open"
            eligible={counts.completePicking.eligible}
            total={counts.completePicking.total}
            onClick={onCompletePicking}
            loading={loadingAction === 'picking'}
            disabled={!!loadingAction}
          />
          <ActionButton
            label="Mark Packing Complete"
            icon="fa-solid fa-box"
            eligible={counts.completePacking.eligible}
            total={counts.completePacking.total}
            onClick={onCompletePacking}
            loading={loadingAction === 'packing'}
            disabled={!!loadingAction}
          />
          <ActionButton
            label="Complete Shipping Details"
            icon="fa-solid fa-truck"
            eligible={counts.shippingDetails.eligible}
            total={counts.shippingDetails.total}
            onClick={onShippingDetails}
            loading={loadingAction === 'shippingDetails'}
            disabled={!!loadingAction}
          />
          <ActionButton
            label={`Ship (${counts.ship.eligible} eligible)`}
            icon="fa-solid fa-paper-plane"
            eligible={counts.ship.eligible}
            total={counts.ship.total}
            onClick={onShip}
            loading={loadingAction === 'ship'}
            disabled={!!loadingAction}
            variant="primary"
          />
        </div>
      </div>
    </div>
  );
}
