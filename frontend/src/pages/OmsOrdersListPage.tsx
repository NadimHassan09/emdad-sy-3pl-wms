import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { AdvancedFilterSection, Button, Card } from '@ds';
import { CompaniesApi } from '../api/companies';
import type { OmsOrderListItem } from '../api/oms';
import { OmsApi } from '../api/oms';
import { OutboundApi } from '../api/outbound';
import { AdminListPageShell } from '../components/AdminListPageShell';
import { Combobox } from '../components/Combobox';
import { OmsOrderFormModal } from '../components/oms/OmsOrderFormModal';
import { OmsOrdersImportModal } from '../components/oms/OmsOrdersImportModal';
import { OmsOrdersExportModal } from '../components/oms/OmsOrdersExportModal';
import { OmsWaybillModal } from '../components/oms/OmsWaybillModal';
import { OmsBulkExecutionPlanModal } from '../components/oms/OmsBulkExecutionPlanModal';
import { OmsBulkShippingDetailsModal } from '../components/oms/OmsBulkShippingDetailsModal';
import { OmsCreateBatchModal } from '../components/oms/OmsCreateBatchModal';
import { OmsAddToBatchModal } from '../components/oms/OmsAddToBatchModal';
import { OmsOrderScanSearchModal } from '../components/oms/OmsOrderScanSearchModal';
import { OmsSingleShippingModal } from '../components/oms/OmsSingleShippingModal';
import { BulkActionResultModal } from '../components/oms/BulkActionResultModal';
import { BulkShippingProcessingModal } from '../components/shipping/BulkShippingProcessingModal';
import { ConfirmModal } from '../components/ConfirmModal';
import { Column, DataTable } from '../components/DataTable';
import { FILTER_PRIMARY_BUTTON_CLASS } from '../components/FilterPanel';
import {
  FILTER_COMPACT_SEARCH_CLASS,
  FILTER_FIELD_CONTROL_CLASS,
  FILTER_FIELD_LABEL_CLASS,
  FILTER_FIELD_LABEL_GAP_CLASS,
} from '../components/filter-panel-styles';
import { RowActionsMenu } from '../components/RowActionsMenu';
import { OmsStatusBadge } from '../components/oms/OmsStatusBadge';
import { OmsStageBadge } from '../components/oms/OmsStageBadge';
import { OmsOrdersStatusNav } from '../components/oms/OmsOrdersStatusNav';
import { useToast } from '../components/ToastProvider';
import { QK } from '../constants/query-keys';
import {
  normalizeWaybillScan,
  orderMatchesWaybillScan,
  waybillScanAttempts,
} from '../lib/oms-waybill-scan';
import {
  useChunkedServerPagination,
} from '../hooks/useChunkedServerPagination';
import { useFilters } from '../hooks/useFilters';
import { companyFilterComboboxOptions } from '../lib/company-filter-options';
import { isOmsOrderDeletable } from '../lib/oms-order-delete';
import { isOmsAdminCancellableStatus } from '../lib/oms-order-cancel';
import { mapOmsCommercialDisplayStatus } from '../lib/oms-commercial-status';
import {
  orderOperationalStage,
  shouldShowOmsStageColumn,
} from '../lib/oms-operational-stage';
import {
  buildOmsAppliedFilterSummary,
  buildOmsOrdersListParams,
  countAppliedOmsAdvancedFilters,
  normalizeOmsOrdersListFilters,
  OMS_ORDERS_FILTER_DEFAULTS,
  OMS_TOTAL_OPERATOR_OPTIONS,
  validateOmsOrderRange,
  type OmsOrdersListFilters,
  type OmsTotalOperator,
} from '../lib/oms-orders-list-filters';
import { useCachedState } from '../hooks/useCachedState';
import type {
  OmsBulkApproveResponse,
  OmsBulkCancelResponse,
  OmsBulkConfirmResponse,
  OmsBulkStatusTransitionResponse,
} from '../api/oms';
import type { BulkIdsResponse } from '../api/outbound';

interface CarrierConfig {
  displayName: string;
  logo: string;
  isSquare?: boolean;
}

const CARRIER_CONFIGS: Record<string, CarrierConfig> = {
  'babel express': {
    displayName: 'Babel Express',
    logo: '/carrier-logos/babel-express.svg',
    isSquare: false,
  },
  'babel': {
    displayName: 'Babel Express',
    logo: '/carrier-logos/babel-express.svg',
    isSquare: false,
  },
  'ترابط': {
    displayName: 'ترابط',
    logo: '/carrier-logos/tarabut.jpeg',
    isSquare: true,
  },
  'tarabut': {
    displayName: 'ترابط',
    logo: '/carrier-logos/tarabut.jpeg',
    isSquare: true,
  },
  'ديليفرو جود': {
    displayName: 'ديليفرو جود',
    logo: '/carrier-logos/deliveroo-joud.svg',
    isSquare: false,
  },
  'deliveroo': {
    displayName: 'ديليفرو جود',
    logo: '/carrier-logos/deliveroo-joud.svg',
    isSquare: false,
  },
  'مسارات': {
    displayName: 'مسارات',
    logo: '/carrier-logos/masarat.png',
    isSquare: false,
  },
  'masarat': {
    displayName: 'مسارات',
    logo: '/carrier-logos/masarat.png',
    isSquare: false,
  },
  'كرم للشحن': {
    displayName: 'كرم للشحن',
    logo: '/carrier-logos/karam.jpeg',
    isSquare: true,
  },
  'كرم': {
    displayName: 'كرم للشحن',
    logo: '/carrier-logos/karam.jpeg',
    isSquare: true,
  },
  'karam': {
    displayName: 'كرم للشحن',
    logo: '/carrier-logos/karam.jpeg',
    isSquare: true,
  },
  'مرسال': {
    displayName: 'مرسال',
    logo: '/carrier-logos/mersal.jpeg',
    isSquare: true,
  },
  'mersal': {
    displayName: 'مرسال',
    logo: '/carrier-logos/mersal.jpeg',
    isSquare: true,
  },
  'تكامل': {
    displayName: 'تكامل',
    logo: '/carrier-logos/takamol.svg',
    isSquare: false,
  },
  'takamol': {
    displayName: 'تكامل',
    logo: '/carrier-logos/takamol.svg',
    isSquare: false,
  },
};

function getCarrierConfig(name: string | null | undefined): CarrierConfig | null {
  if (!name) return null;
  const lower = name.trim().toLowerCase();
  for (const [key, cfg] of Object.entries(CARRIER_CONFIGS)) {
    if (lower === key || lower.includes(key)) {
      return cfg;
    }
  }
  return null;
}

function OmsCarrierCell({
  carrier,
  shippingMethod,
  isManualShipping,
  outboundStatus,
  isArabic,
}: {
  carrier?: string | null;
  shippingMethod?: string | null;
  isManualShipping?: boolean;
  outboundStatus?: string | null;
  isArabic: boolean;
}) {
  const isPreShipping =
    !outboundStatus ||
    outboundStatus === 'draft' ||
    outboundStatus === 'allocated' ||
    outboundStatus === 'picking' ||
    outboundStatus === 'packing';

  const trimmedCarrier = carrier?.trim();
  const isExplicitManual = !isPreShipping && (isManualShipping || shippingMethod === 'manual');

  if (isPreShipping || (!trimmedCarrier && !isExplicitManual)) {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium bg-surface-sunken text-text-muted border border-border-subtle shadow-xs whitespace-nowrap"
        title={isArabic ? 'قيد التحديد / لم يحدد بعد' : 'To Be Determined'}
      >
        <i className="fa-regular fa-clock text-[11px] text-text-faint" aria-hidden="true" />
        <span>{isArabic ? 'قيد التحديد' : 'To Be Determined'}</span>
      </span>
    );
  }

  if (isExplicitManual) {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 shadow-xs whitespace-nowrap"
        title={isArabic ? 'شحن يدوي' : 'Manual Shipping'}
      >
        <i className="fa-solid fa-boxes-packing text-[11px] text-amber-600 dark:text-amber-400" aria-hidden="true" />
        <span>Manual Shipping</span>
      </span>
    );
  }

  const config = getCarrierConfig(trimmedCarrier);

  if (!config) {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold bg-surface-panel text-text-strong border border-border-subtle shadow-xs whitespace-nowrap"
        title={trimmedCarrier}
      >
        <i className="fa-solid fa-truck-fast text-[11px] text-primary" aria-hidden="true" />
        <span className="truncate max-w-[120px]">{trimmedCarrier}</span>
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-2 rounded-md bg-white dark:bg-surface-panel px-2.5 py-1 text-xs font-semibold text-text-strong border border-border-subtle shadow-xs hover:border-border-strong transition-colors whitespace-nowrap"
      title={trimmedCarrier}
    >
      <img
        src={config.logo}
        alt={trimmedCarrier}
        className={
          config.isSquare
            ? 'h-5 w-5 rounded object-cover border border-slate-200/80 bg-white shrink-0'
            : 'h-4 max-w-[60px] object-contain shrink-0'
        }
        loading="lazy"
      />
      <span className="truncate max-w-[120px] font-medium">{trimmedCarrier}</span>
    </span>
  );
}

function canOrderHaveWaybill(row: OmsOrderListItem): boolean {
  const eligibleStatuses = [
    'ready_to_ship',
    'shipped',
    'out_for_delivery',
    'delivered',
    'failed_delivery',
    'returned',
    'cancelled',
  ];
  if (!eligibleStatuses.includes(row.status)) {
    return false;
  }
  const hasCarrierOrTracking =
    Boolean(row.carrier?.trim()) ||
    Boolean(row.trackingNumber?.trim()) ||
    row.isManualShipping ||
    row.shippingMethod === 'manual';
  return Boolean(hasCarrierOrTracking);
}

function FilterFieldLabel({ children }: { children: string }) {
  return (
    <label className={`${FILTER_FIELD_LABEL_CLASS} ${FILTER_FIELD_LABEL_GAP_CLASS}`}>
      {children}
    </label>
  );
}

type OmsQrStatusAction = 'confirm' | 'approve' | 'handover' | 'delivered' | 'failed';

const MAX_PAGE_SIZE = 1000;
const PAGE_SIZE_PRESETS = ['50', '100', '200', '500', '1000'] as const;

/** Bulk stage buttons are hidden in the selection toolbar (batch workflow); handlers are kept. */
const SHOW_LEGACY_BULK_STAGE_ACTIONS = true;

/** Backend fetch size: 200 when it divides evenly, otherwise one UI page per chunk. */
function resolveChunkSize(pageSize: number): number {
  if (pageSize <= 200) return 200 % pageSize === 0 ? 200 : pageSize;
  return pageSize;
}

type BulkResult =
  | OmsBulkApproveResponse
  | OmsBulkConfirmResponse
  | OmsBulkCancelResponse
  | OmsBulkStatusTransitionResponse
  | BulkIdsResponse;

function statusScanCopy(
  action: OmsQrStatusAction | null,
  isArabic: boolean,
): { title: string; hint: string } {
  switch (action) {
    case 'confirm':
      return {
        title: isArabic ? 'تأكيد الطلب بالـ QR' : 'Confirm order by QR',
        hint: isArabic
          ? 'وجّه الكاميرا إلى QR البوليصة لتأكيد الطلب (بانتظار التأكيد فقط)، ثم امسح الطلب التالي.'
          : 'Point the camera at the waybill QR to confirm the order (waiting-for-confirmation only), then scan the next one.',
      };
    case 'approve':
      return {
        title: isArabic ? 'اعتماد الطلب بالـ QR' : 'Approve order by QR',
        hint: isArabic
          ? 'وجّه الكاميرا إلى QR البوليصة لاعتماد الطلب (بانتظار الاعتماد فقط)، ثم امسح الطلب التالي.'
          : 'Point the camera at the waybill QR to approve the order (waiting-for-approval only), then scan the next one.',
      };
    case 'handover':
      return {
        title: isArabic ? 'تسليم لشركة الشحن بالـ QR' : 'Handover to carrier by QR',
        hint: isArabic
          ? 'وجّه الكاميرا إلى QR البوليصة. الطلب الجاهز للشحن يصبح خارجًا للتسليم فورًا، ويمكنك مسح الطلب التالي.'
          : 'Point the camera at the waybill QR. A ready-to-ship order is marked out for delivery immediately, then scan the next one.',
      };
    case 'delivered':
      return {
        title: isArabic ? 'تسجيل التسليم بالـ QR' : 'Mark delivered by QR',
        hint: isArabic
          ? 'وجّه الكاميرا إلى QR البوليصة لتسجيل أن الطلب تم تسليمه، ثم امسح الطلب التالي.'
          : 'Point the camera at the waybill QR to mark the order delivered, then scan the next one.',
      };
    default:
      return {
        title: isArabic ? 'تسجيل تعذر التسليم بالـ QR' : 'Mark failed delivery by QR',
        hint: isArabic
          ? 'وجّه الكاميرا إلى QR البوليصة لتسجيل تعذر التسليم، ثم امسح الطلب التالي.'
          : 'Point the camera at the waybill QR to mark failed delivery, then scan the next one.',
      };
  }
}

export function OmsOrdersListPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const isArabic =
    typeof window !== 'undefined' &&
    (window.localStorage.getItem('wms-ui-language') === 'AR' || document.documentElement.dir === 'rtl');

  const [editOrderId, setEditOrderId] = useState<string | null>(null);
  const [deleteOrder, setDeleteOrder] = useState<OmsOrderListItem | null>(null);
  const [singleCancelOrder, setSingleCancelOrder] = useState<OmsOrderListItem | null>(null);
  const [singleShippingOrder, setSingleShippingOrder] = useState<OmsOrderListItem | null>(null);
  const [bulkCancelConfirmOpen, setBulkCancelConfirmOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [scanSearchOpen, setScanSearchOpen] = useState(false);
  const [statusScan, setStatusScan] = useState<null | OmsQrStatusAction>(null);
  const [exporting, setExporting] = useState(false);
  const [waybillOrderId, setWaybillOrderId] = useState<string | null>(null);
  const [exportingWaybills, setExportingWaybills] = useState(false);
  const [downloadingInstructions, setDownloadingInstructions] = useState<'pdf' | 'zip' | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [exportColumns, setExportColumns] = useState<Array<{ id: string; labelEn: string; labelAr: string }>>([]);
  const [advancedOpen, setAdvancedOpen] = useCachedState(
    'oms-orders:advanced-filters-open',
    false,
  );

  // ─── Bulk state ─────────────────────────────────────────────────────────────
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [processModalOpen, setProcessModalOpen] = useState(false);
  const [shippingDetailsModalOpen, setShippingDetailsModalOpen] = useState(false);
  const [createBatchOpen, setCreateBatchOpen] = useState(false);
  const [addToBatchOpen, setAddToBatchOpen] = useState(false);
  const [pageSizeChoice, setPageSizeChoice] = useCachedState<string>('oms-orders:page-size-choice', '50');
  const [customPageSize, setCustomPageSize] = useCachedState<string>('oms-orders:page-size-custom', '');
  const [shipModalOpen, setShipModalOpen] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ title: string; result: BulkResult } | null>(null);

  const editDetailQuery = useQuery({
    queryKey: [...QK.omsOrders, editOrderId],
    queryFn: () => OmsApi.getOrder(editOrderId!),
    enabled: !!editOrderId,
  });

  const companiesQuery = useQuery({
    queryKey: QK.companies,
    queryFn: () => CompaniesApi.list(),
    staleTime: 10 * 60_000,
  });

  const clientOptions = useMemo(
    () =>
      companyFilterComboboxOptions(
        companiesQuery.data,
        isArabic ? 'كل العملاء' : 'All clients',
      ),
    [companiesQuery.data, isArabic],
  );

  const carrierOptions = useMemo(
    () => [
      { value: '', label: isArabic ? 'جميع شركات الشحن' : 'All carriers' },
      { value: 'Babel Express', label: 'Babel Express' },
      { value: 'ترابط', label: isArabic ? 'ترابط' : 'Tarabut (ترابط)' },
      { value: 'ديليفرو جود', label: isArabic ? 'ديليفرو جود' : 'Deliveroo Joud (ديليفرو جود)' },
      { value: 'كرم للشحن', label: isArabic ? 'كرم للشحن' : 'Karam Express (كرم للشحن)' },
      { value: 'مسارات', label: isArabic ? 'مسارات' : 'Masarat (مسارات)' },
      { value: 'مرسال', label: isArabic ? 'مرسال' : 'Mersal (مرسال)' },
      { value: 'تكامل', label: isArabic ? 'تكامل' : 'Takamol (تكامل)' },
    ],
    [isArabic],
  );

  const {
    draftFilters: draftFiltersRaw,
    appliedFilters: appliedFiltersRaw,
    setDraft,
    applyPatch,
    applyFilters,
    resetFilters,
  } = useFilters<OmsOrdersListFilters>(OMS_ORDERS_FILTER_DEFAULTS);

  // Older cached filter entries only had orderSearch/status — fill missing keys.
  const draftFilters = useMemo(
    () => normalizeOmsOrdersListFilters(draftFiltersRaw),
    [draftFiltersRaw],
  );
  const appliedFilters = useMemo(
    () => normalizeOmsOrdersListFilters(appliedFiltersRaw),
    [appliedFiltersRaw],
  );

  const listParams = useMemo(
    () => buildOmsOrdersListParams(appliedFilters),
    [appliedFilters],
  );

  const navCountParams = useMemo(() => {
    const { status: _status, operationalStage: _stage, ...rest } = listParams;
    return rest;
  }, [listParams]);

  const navCountsQuery = useQuery({
    queryKey: [...QK.omsOrders, 'nav-counts', navCountParams],
    queryFn: () => OmsApi.statusNavCounts(navCountParams),
  });

  const pageSize = useMemo(() => {
    if (pageSizeChoice === 'custom') {
      const n = Math.floor(Number(customPageSize));
      return Number.isFinite(n) && n >= 1 && n <= MAX_PAGE_SIZE ? n : 50;
    }
    const n = Number(pageSizeChoice);
    return (PAGE_SIZE_PRESETS as readonly string[]).includes(pageSizeChoice) ? n : 50;
  }, [pageSizeChoice, customPageSize]);
  const chunkSize = resolveChunkSize(pageSize);

  const pagination = useChunkedServerPagination<OmsOrderListItem>({
    chunkSize,
    pageSize,
    filterKey: listParams,
    fetchChunk: (offset, limit) => OmsApi.list({ ...listParams, offset, limit }),
    rtQueryKeyPrefix: QK.omsOrders,
    chunkQueryKeyPrefix: 'oms-orders-chunk',
  });

  const changePageSize = (choice: string) => {
    setPageSizeChoice(choice);
    pagination.resetPage();
  };

  const onCustomPageSizeChange = (raw: string) => {
    const digits = raw.replace(/[^0-9]/g, '');
    if (!digits) {
      setCustomPageSize('');
      return;
    }
    const clamped = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(digits)));
    setCustomPageSize(String(clamped));
    pagination.resetPage();
  };

  const advancedActiveCount = countAppliedOmsAdvancedFilters({
    ...appliedFilters,
    status: '',
  });
  const clientName =
    companiesQuery.data?.find((c) => c.id === appliedFilters.companyId)?.name ?? null;
  const appliedSummary = useMemo(
    () =>
      buildOmsAppliedFilterSummary(appliedFilters, {
        clientName,
        isArabic,
      }),
    [appliedFilters, clientName, isArabic],
  );

  const draftRangeError = useMemo(
    () =>
      validateOmsOrderRange(
        draftFilters.startOrderNo,
        draftFilters.endOrderNo,
        isArabic,
      ),
    [draftFilters.startOrderNo, draftFilters.endOrderNo, isArabic],
  );

  const onApplyFilters = () => {
    if (draftRangeError) return;
    if (advancedOpen) {
      applyPatch({
        ...draftFilters,
        orderSearch: '',
      });
      return;
    }
    applyFilters();
  };

  const onResetFilters = () => {
    resetFilters();
    setAdvancedOpen(false);
  };

  const deleteMut = useMutation({
    mutationFn: (id: string) => OmsApi.delete(id),
    onSuccess: () => {
      toast.success('E-commerce order deleted.');
      setDeleteOrder(null);
      void qc.invalidateQueries({ queryKey: QK.omsOrders });
    },
    onError: (e: Error) => toast.error(e.message),
  });


  useEffect(() => {
    void OmsApi.exportColumns()
      .then(setExportColumns)
      .catch(() => setExportColumns([]));
  }, []);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [listParams]);

  const pageIds = useMemo(() => pagination.rows.map((r) => r.id), [pagination.rows]);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const somePageSelected = pageIds.some((id) => selectedIds.has(id)) && !allPageSelected;

  const toggleOne = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleAllPage = (checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of pageIds) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  };

  // ─── Derived selected orders ─────────────────────────────────────────────────
  const selectedOrders = useMemo(
    () => pagination.rows.filter((r) => selectedIds.has(r.id)),
    [pagination.rows, selectedIds],
  );

  const waitingConfirmOrders = useMemo(
    () => selectedOrders.filter((o) => o.status === 'waiting_for_confirmation'),
    [selectedOrders],
  );

  const waitingApprovalOrders = useMemo(
    () =>
      selectedOrders.filter(
        (o) =>
          o.status === 'confirmed_waiting_for_admin_approval' ||
          o.status === 'pending_approval' ||
          o.status === 'pending',
      ),
    [selectedOrders],
  );

  const cancellableSelectedOrders = useMemo(
    () => selectedOrders.filter((o) => isOmsAdminCancellableStatus(o.status) && o.status !== 'cancelled'),
    [selectedOrders],
  );

  const pickingEligibleOrders = useMemo(
    () =>
      selectedOrders.filter((o) => {
        const outboundStatus = o.linkedOutboundOrder?.status;
        return (
          o.status === 'processing' &&
          (outboundStatus === 'picking' ||
            outboundStatus === 'draft' ||
            outboundStatus === 'allocated' ||
            outboundStatus === 'pending_approval' ||
            outboundStatus === 'confirmed' ||
            outboundStatus === 'pending_stock')
        );
      }),
    [selectedOrders],
  );

  const packingEligibleOrders = useMemo(
    () =>
      selectedOrders.filter((o) => {
        const outboundStatus = o.linkedOutboundOrder?.status;
        return o.status === 'processing' && outboundStatus === 'packing';
      }),
    [selectedOrders],
  );

  const shippingDetailsEligibleOrders = useMemo(
    () =>
      selectedOrders.filter((o) => {
        const outboundStatus = o.linkedOutboundOrder?.status;
        const isShippingStage =
          outboundStatus === 'waiting_for_shipping_method' ||
          outboundStatus === 'waiting_for_shipping_details';
        const hasShipmentSent = Boolean(
          o.trackingNumber?.trim() ||
          o.linkedOutboundOrder?.trackingNumber?.trim() ||
          o.linkedOutboundOrder?.hasCarrierShipment,
        );
        return isShippingStage && !hasShipmentSent;
      }),
    [selectedOrders],
  );

  const shippingConfirmEligibleOrders = useMemo(
    () =>
      selectedOrders.filter((o) => {
        const outboundStatus = o.linkedOutboundOrder?.status;
        const isShippingStage =
          outboundStatus === 'waiting_for_shipping_method' ||
          outboundStatus === 'waiting_for_shipping_details';
        const hasShipmentSent = Boolean(
          o.trackingNumber?.trim() ||
          o.linkedOutboundOrder?.trackingNumber?.trim() ||
          o.linkedOutboundOrder?.hasCarrierShipment,
        );
        return isShippingStage && hasShipmentSent;
      }),
    [selectedOrders],
  );

  const dispatchEligibleOrders = useMemo(
    () =>
      selectedOrders.filter(
        (o) =>
          o.status === 'ready_to_ship' ||
          o.linkedOutboundOrder?.status === 'ready_to_ship' ||
          o.linkedOutboundOrder?.status === 'packed',
      ),
    [selectedOrders],
  );

  const deliveryEligibleOrders = useMemo(
    () =>
      selectedOrders.filter(
        (o) => o.status === 'shipped' || o.status === 'out_for_delivery',
      ),
    [selectedOrders],
  );

  const returnEligibleOrders = useMemo(
    () => selectedOrders.filter((o) => o.status === 'failed_delivery'),
    [selectedOrders],
  );

  const waybillEligibleOrders = useMemo(
    () => selectedOrders.filter((o) => canOrderHaveWaybill(o)),
    [selectedOrders],
  );

  const instructionEligibleOrders = useMemo(
    () =>
      selectedOrders.filter(
        (o) => mapOmsCommercialDisplayStatus(o.status) === 'processing',
      ),
    [selectedOrders],
  );

  // ─── Single action mutations ──────────────────────────────────────────────────
  const confirmSingleMut = useMutation({
    mutationFn: (orderId: string) => OmsApi.confirm(orderId),
    onSuccess: () => {
      toast.success(
        isArabic
          ? 'تم تأكيد الطلب بنجاح (بانتظار موافقة الإدارة).'
          : 'Order confirmed (waiting for admin approval).',
      );
      void qc.invalidateQueries({ queryKey: QK.omsOrders });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const approveSingleMut = useMutation({
    mutationFn: (orderId: string) => OmsApi.approve(orderId),
    onSuccess: () => {
      toast.success(
        isArabic
          ? 'تمت الموافقة على الطلب بنجاح وتحويله للمعالجة.'
          : 'Order approved and transitioned to processing.',
      );
      void qc.invalidateQueries({ queryKey: QK.omsOrders });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const completePickingSingleMut = useMutation({
    mutationFn: (outboundId: string) => OutboundApi.completePicking(outboundId),
    onSuccess: () => {
      toast.success(
        isArabic ? 'تم إكمال مرحلة الالتقاط بنجاح.' : 'Picking completed successfully.',
      );
      void qc.invalidateQueries({ queryKey: QK.omsOrders });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const completePackingSingleMut = useMutation({
    mutationFn: (outboundId: string) => OutboundApi.completePacking(outboundId),
    onSuccess: () => {
      toast.success(
        isArabic ? 'تم إكمال مرحلة التعبئة بنجاح.' : 'Packing completed successfully.',
      );
      void qc.invalidateQueries({ queryKey: QK.omsOrders });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const completeShippingDetailsSingleMut = useMutation({
    mutationFn: (outboundId: string) => OutboundApi.completeShippingDetails(outboundId),
    onSuccess: () => {
      toast.success(
        isArabic ? 'تم تأكيد اكتمال الشحن بنجاح، الطلب جاهز للشحن.' : 'Shipping marked complete successfully.',
      );
      void qc.invalidateQueries({ queryKey: QK.omsOrders });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [isBulkCompletingShipping, setIsBulkCompletingShipping] = useState(false);

  const handleBulkConfirmShippingComplete = async () => {
    if (shippingConfirmEligibleOrders.length === 0 || isBulkCompletingShipping) return;
    setIsBulkCompletingShipping(true);
    let successCount = 0;
    const errors: string[] = [];

    for (const order of shippingConfirmEligibleOrders) {
      const outboundId = order.outboundOrderId ?? order.linkedOutboundOrder?.id;
      if (!outboundId) continue;
      try {
        await OutboundApi.completeShippingDetails(outboundId);
        successCount++;
      } catch (err: unknown) {
        errors.push(`${order.orderNumber}: ${err instanceof Error ? err.message : 'Failed'}`);
      }
    }

    setIsBulkCompletingShipping(false);
    void qc.invalidateQueries({ queryKey: QK.omsOrders });

    if (successCount > 0) {
      toast.success(
        isArabic
          ? `تم تأكيد اكتمال الشحن لـ ${successCount} طلب بنجاح، أصبحت جاهزة للشحن!`
          : `Marked shipping complete for ${successCount} order(s).`,
      );
    }
    if (errors.length > 0) {
      toast.error(errors.slice(0, 3).join(' | '));
    }
  };

  const completeDispatchSingleMut = useMutation({
    mutationFn: (outboundId: string) => OutboundApi.completeDispatch(outboundId),
    onSuccess: () => {
      toast.success(
        isArabic ? 'تم إكمال الإرسال وخروج الشحنة للتسليم.' : 'Dispatch completed (shipped).',
      );
      void qc.invalidateQueries({ queryKey: QK.omsOrders });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const markDeliveredSingleMut = useMutation({
    mutationFn: (orderId: string) => OmsApi.delivered(orderId),
    onSuccess: () => {
      toast.success(
        isArabic ? 'تم تأكيد تسليم الطلب للعميل.' : 'Order marked as delivered.',
      );
      void qc.invalidateQueries({ queryKey: QK.omsOrders });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const markFailedDeliverySingleMut = useMutation({
    mutationFn: (orderId: string) => OmsApi.failedDelivery(orderId),
    onSuccess: () => {
      toast.success(
        isArabic ? 'تم تسجيل تعذر تسليم الطلب.' : 'Order marked as failed delivery.',
      );
      void qc.invalidateQueries({ queryKey: QK.omsOrders });
      void qc.invalidateQueries({ queryKey: ['oms-returns'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const markReturnedSingleMut = useMutation({
    mutationFn: (orderId: string) => OmsApi.returned(orderId),
    onSuccess: () => {
      toast.success(
        isArabic
          ? 'تم إنشاء طلب الإرجاع بنجاح (بانتظار التأكيد في صفحة المرتجعات).'
          : 'Return request created (awaiting confirmation in Returns).',
      );
      void qc.invalidateQueries({ queryKey: QK.omsOrders });
      void qc.invalidateQueries({ queryKey: ['oms-returns'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelSingleMut = useMutation({
    mutationFn: (orderId: string) => OmsApi.cancel(orderId),
    onSuccess: () => {
      toast.success(isArabic ? 'تم إلغاء الطلب بنجاح.' : 'Order cancelled successfully.');
      setSingleCancelOrder(null);
      void qc.invalidateQueries({ queryKey: QK.omsOrders });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ─── Bulk action handlers ─────────────────────────────────────────────────────

  const handleBulkConfirm = async () => {
    const ids = waitingConfirmOrders.map((o) => o.id);
    if (!ids.length) return;
    setLoadingAction('confirm');
    try {
      const result = await OmsApi.confirmBulk(ids);
      setBulkResult({ title: isArabic ? 'نتائج تأكيد الطلبات' : 'Bulk Confirm Results', result });
      void qc.invalidateQueries({ queryKey: QK.omsOrders });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Bulk confirm failed.');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleBulkApprove = async () => {
    const ids = waitingApprovalOrders.map((o) => o.id);
    if (!ids.length) return;
    setLoadingAction('approve');
    try {
      const result = await OmsApi.approveBulk(ids);
      setBulkResult({ title: isArabic ? 'نتائج اعتماد الطلبات' : 'Bulk Approve Results', result });
      void qc.invalidateQueries({ queryKey: QK.omsOrders });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Bulk approve failed.');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleBulkCancel = async () => {
    const ids = cancellableSelectedOrders.map((o) => o.id);
    if (!ids.length) return;
    setLoadingAction('cancel');
    setBulkCancelConfirmOpen(false);
    try {
      const result = await OmsApi.cancelBulk(ids);
      setBulkResult({ title: isArabic ? 'نتائج إلغاء الطلبات' : 'Bulk Cancel Results', result });
      void qc.invalidateQueries({ queryKey: QK.omsOrders });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Bulk cancel failed.');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleBulkProcess = () => {
    setProcessModalOpen(true);
  };

  const handleProcessConfirm = async (items: Parameters<typeof OutboundApi.bulkProcess>[0]) => {
    setLoadingAction('process');
    try {
      const result = await OutboundApi.bulkProcess(items);
      setProcessModalOpen(false);
      setBulkResult({ title: 'Bulk Process Results', result });
      void qc.invalidateQueries({ queryKey: QK.omsOrders });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Bulk process failed.');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleBulkCompletePicking = async () => {
    const outboundIds = pickingEligibleOrders
      .map((o) => o.outboundOrderId ?? o.linkedOutboundOrder?.id)
      .filter((id): id is string => !!id);
    if (!outboundIds.length) {
      toast.error(isArabic ? 'لا توجد طلبات في مرحلة الالتقاط.' : 'No orders in picking stage.');
      return;
    }
    setLoadingAction('picking');
    try {
      const result = await OutboundApi.bulkCompletePicking(outboundIds);
      setBulkResult({ title: isArabic ? 'نتائج إكمال الالتقاط' : 'Mark Picking Complete Results', result });
      void qc.invalidateQueries({ queryKey: QK.omsOrders });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Bulk complete picking failed.');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleBulkCompletePacking = async () => {
    const outboundIds = packingEligibleOrders
      .map((o) => o.outboundOrderId ?? o.linkedOutboundOrder?.id)
      .filter((id): id is string => !!id);
    if (!outboundIds.length) {
      toast.error(isArabic ? 'لا توجد طلبات في مرحلة التعبئة.' : 'No orders in packing stage.');
      return;
    }
    setLoadingAction('packing');
    try {
      const result = await OutboundApi.bulkCompletePacking(outboundIds);
      setBulkResult({ title: isArabic ? 'نتائج إكمال التعبئة' : 'Mark Packing Complete Results', result });
      void qc.invalidateQueries({ queryKey: QK.omsOrders });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Bulk complete packing failed.');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleBulkCompleteDispatch = async () => {
    const outboundIds = dispatchEligibleOrders
      .map((o) => o.outboundOrderId ?? o.linkedOutboundOrder?.id)
      .filter((id): id is string => !!id);
    if (!outboundIds.length) {
      toast.error(isArabic ? 'لا توجد طلبات جاهزة للإرسال.' : 'No orders ready for dispatch.');
      return;
    }
    setLoadingAction('dispatch');
    try {
      const result = await OutboundApi.bulkCompleteDispatch(outboundIds);
      setBulkResult({ title: isArabic ? 'نتائج إكمال الإرسال والخروج للتسليم' : 'Complete Dispatch Results', result });
      void qc.invalidateQueries({ queryKey: QK.omsOrders });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Bulk complete dispatch failed.');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleBulkDelivered = async () => {
    const ids = deliveryEligibleOrders.map((o) => o.id);
    if (!ids.length) return;
    setLoadingAction('delivered');
    try {
      const result = await OmsApi.deliveredBulk(ids);
      setBulkResult({ title: isArabic ? 'نتائج تأكيد تسليم الطلبات' : 'Bulk Delivered Results', result });
      void qc.invalidateQueries({ queryKey: QK.omsOrders });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Bulk delivered failed.');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleBulkFailedDelivery = async () => {
    const ids = deliveryEligibleOrders.map((o) => o.id);
    if (!ids.length) return;
    setLoadingAction('failedDelivery');
    try {
      const result = await OmsApi.failedDeliveryBulk(ids);
      setBulkResult({ title: isArabic ? 'نتائج تعذر تسليم الطلبات' : 'Bulk Failed Delivery Results', result });
      void qc.invalidateQueries({ queryKey: QK.omsOrders });
      void qc.invalidateQueries({ queryKey: ['oms-returns'] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Bulk failed delivery failed.');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleWaybillStatusScan = async (raw: string) => {
    const kind = statusScan;
    if (!kind) return { ok: false, message: '' };
    const code = normalizeWaybillScan(raw);
    if (!code) {
      return {
        ok: false,
        message: isArabic ? 'الرمز فارغ.' : 'The scanned code is empty.',
      };
    }

    let order: OmsOrderListItem | undefined;
    for (const attempt of waybillScanAttempts(code)) {
      const page = await OmsApi.list({ orderSearch: attempt, limit: 25 });
      const exact = page.items.filter(
        (item) => orderMatchesWaybillScan(item, code) || orderMatchesWaybillScan(item, attempt),
      );
      if (exact.length > 1) {
        return {
          ok: false,
          message: isArabic
            ? `الرمز ${code} يطابق أكثر من طلب.`
            : `${code} matches more than one order.`,
        };
      }
      if (exact.length === 1) {
        order = exact[0];
        break;
      }
    }
    if (!order) {
      return {
        ok: false,
        message: isArabic ? `لا يوجد طلب للرمز ${code}.` : `No order found for ${code}.`,
      };
    }

    const outForDelivery = order.status === 'shipped' || order.status === 'out_for_delivery';
    const label = order.orderNumber;
    const wrongState = (en: string, ar: string) => ({
      ok: false,
      message: isArabic ? `${label} ${ar}` : `${label} ${en}`,
    });
    try {
      if (kind === 'confirm') {
        if (order.status !== 'waiting_for_confirmation') {
          return wrongState('is not waiting for confirmation.', 'ليس بانتظار التأكيد.');
        }
        await OmsApi.confirm(order.id);
        void qc.invalidateQueries({ queryKey: QK.omsOrders });
        return {
          ok: true,
          message: isArabic ? `${label} — تم التأكيد` : `${label} — confirmed`,
        };
      }

      if (kind === 'approve') {
        const approvable =
          order.status === 'confirmed_waiting_for_admin_approval' ||
          order.status === 'pending_approval' ||
          order.status === 'pending';
        if (!approvable) {
          return wrongState('is not waiting for approval.', 'ليس بانتظار الاعتماد.');
        }
        await OmsApi.approve(order.id);
        void qc.invalidateQueries({ queryKey: QK.omsOrders });
        return {
          ok: true,
          message: isArabic ? `${label} — تم الاعتماد` : `${label} — approved`,
        };
      }

      if (kind === 'handover') {
        if (order.status !== 'ready_to_ship') {
          return wrongState('is not ready to ship.', 'ليس جاهزًا للشحن.');
        }
        const outboundId = order.outboundOrderId ?? order.linkedOutboundOrder?.id;
        if (!outboundId) {
          return wrongState('has no warehouse order.', 'غير مرتبط بطلب مستودع.');
        }
        await OutboundApi.completeDispatch(outboundId, order.companyId);
        void qc.invalidateQueries({ queryKey: QK.omsOrders });
        return {
          ok: true,
          message: isArabic ? `${label} — خرج للتسليم` : `${label} — out for delivery`,
        };
      }

      if (!outForDelivery) {
        return wrongState('is not out for delivery.', 'ليس خارجًا للتسليم.');
      }
      if (kind === 'delivered') {
        await OmsApi.delivered(order.id);
        void qc.invalidateQueries({ queryKey: QK.omsOrders });
        return {
          ok: true,
          message: isArabic ? `${label} — تم التسليم` : `${label} — delivered`,
        };
      }
      await OmsApi.failedDelivery(order.id);
      void qc.invalidateQueries({ queryKey: QK.omsOrders });
      void qc.invalidateQueries({ queryKey: ['oms-returns'] });
      return {
        ok: true,
        message: isArabic ? `${label} — تعذر التسليم` : `${label} — failed delivery`,
      };
    } catch (error) {
      // Backend assertOmsTransition errors surface here verbatim.
      return {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : isArabic
              ? `تعذر تحديث ${label}.`
              : `Could not update ${label}.`,
      };
    }
  };

  const handleBulkReturned = async () => {
    const ids = returnEligibleOrders.map((o) => o.id);
    if (!ids.length) return;
    setLoadingAction('returned');
    try {
      const result = await OmsApi.returnedBulk(ids);
      setBulkResult({
        title: isArabic ? 'نتائج تحويل الطلبات لمرتجع' : 'Bulk Return Results',
        result,
      });
      void qc.invalidateQueries({ queryKey: QK.omsOrders });
      void qc.invalidateQueries({ queryKey: ['oms-returns'] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Bulk return failed.');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleBulkShippingDetails = () => {
    setShippingDetailsModalOpen(true);
  };

  const handleBulkShip = () => {
    setShipModalOpen(true);
  };

  // ─── Ship outbound IDs (ready_to_ship OMS orders) ────────────────────────────
  const shipOutboundIds = useMemo(
    () =>
      selectedOrders
        .filter((o) => o.status === 'ready_to_ship')
        .map((o) => o.outboundOrderId ?? o.linkedOutboundOrder?.id)
        .filter((id): id is string => !!id),
    [selectedOrders],
  );

  const onExportSubmit = async (payload: { columnIds: string[]; arabicHeaders: boolean }) => {
    if (exporting) return;
    setExporting(true);
    try {
      const ids = selectedIds.size > 0 ? Array.from(selectedIds) : undefined;
      await OmsApi.exportDownloadPost({
        ...listParams,
        ...payload,
        ids,
      });
      setExportOpen(false);
      toast.success(
        isArabic ? 'تم تنزيل ملف CSV.' : 'Exported OMS orders to CSV.',
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Export failed.');
    } finally {
      setExporting(false);
    }
  };

  const handleWaybillsPdf = async (mode: 'download' | 'print') => {
    if (exportingWaybills || selectedIds.size === 0) return;
    setExportingWaybills(true);
    try {
      await OmsApi.downloadWaybillsPdf(Array.from(selectedIds), mode);
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message
          : (isArabic ? 'فشل تجهيز بوالص الشحن' : 'Failed to prepare waybills'),
      );
    } finally {
      setExportingWaybills(false);
    }
  };

  const handleDownloadInstructions = async (order: OmsOrderListItem) => {
    try {
      await OmsApi.downloadInstructionPdf(order.id, order.orderNumber);
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message
          : isArabic
            ? 'تعذر تنزيل تعليمات التنفيذ.'
            : 'Could not download the instructions PDF.',
      );
    }
  };

  const handleDownloadInstructionBulk = async (mode: 'pdf' | 'zip') => {
    if (downloadingInstructions || instructionEligibleOrders.length === 0) return;
    const skipped = selectedOrders.length - instructionEligibleOrders.length;
    setDownloadingInstructions(mode);
    try {
      const ids = instructionEligibleOrders.map((order) => order.id);
      if (mode === 'pdf') await OmsApi.downloadInstructionsPdf(ids);
      else await OmsApi.downloadInstructionsZip(ids);
      const skippedNote =
        skipped > 0
          ? isArabic
            ? ` تم تجاهل ${skipped} طلب لأنها ليست قيد المعالجة.`
            : ` Skipped ${skipped} order(s) that are not in processing.`
          : '';
      toast.success(
        (isArabic
          ? mode === 'pdf'
            ? 'تم تنزيل ملف التعليمات.'
            : 'تم تنزيل ملف التعليمات المضغوط.'
          : mode === 'pdf'
            ? 'Instructions PDF downloaded.'
            : 'Instructions ZIP downloaded.') + skippedNote,
      );
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message
          : isArabic
            ? 'تعذر تنزيل تعليمات التنفيذ.'
            : 'Could not download instructions.',
      );
    } finally {
      setDownloadingInstructions(null);
    }
  };

  const navActions = (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Button variant="secondary" size="md" onClick={() => setImportOpen(true)}>
        {isArabic ? 'استيراد' : 'Import'}
      </Button>
      <Button
        variant="secondary"
        size="md"
        loading={exporting}
        disabled={exporting}
        onClick={() => setExportOpen(true)}
      >
        {isArabic ? 'تصدير CSV' : 'Export CSV'}
      </Button>
      <Button
        variant="primary"
        size="md"
        onClick={() => navigate('/orders/oms/new')}
        className={FILTER_PRIMARY_BUTTON_CLASS}
      >
        {isArabic ? 'إنشاء طلب OMS' : 'Create OMS Order'}
      </Button>
    </div>
  );

  const columns: Column<OmsOrderListItem>[] = [
    {
      header: (
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-border-strong text-brand focus:ring-brand"
          checked={allPageSelected}
          ref={(el) => {
            if (el) el.indeterminate = somePageSelected;
          }}
          aria-label={isArabic ? 'تحديد الكل في الصفحة' : 'Select all on page'}
          onChange={(e) => toggleAllPage(e.target.checked)}
          onClick={(e) => e.stopPropagation()}
        />
      ),
      width: '2.5rem',
      accessor: (row) => (
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-border-strong text-brand focus:ring-brand"
          checked={selectedIds.has(row.id)}
          aria-label={`Select ${row.orderNumber}`}
          onChange={(e) => toggleOne(row.id, e.target.checked)}
          onClick={(e) => e.stopPropagation()}
        />
      ),
    },
    {
      header: isArabic ? 'رقم الطلب' : 'Order #',
      accessor: (row) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-medium text-text-strong">{row.orderNumber}</span>
          <time
            className="text-xs tabular-nums text-text-muted"
            dateTime={row.createdAt}
          >
            {isArabic ? 'تاريخ الإنشاء: ' : 'Created: '}
            {new Date(row.createdAt).toLocaleString()}
          </time>
        </div>
      ),
    },
    {
      header: isArabic ? 'العميل' : 'Client',
      accessor: (row) => row.company?.name?.trim() || '—',
    },
    {
      header: isArabic ? 'الزبون' : 'Customer',
      accessor: (row) => row.recipientName?.trim() || '—',
    },
    {
      header: isArabic ? 'الهاتف' : 'Phone',
      accessor: (row) => row.recipientPhone?.trim() || '—',
    },
    {
      header: isArabic ? 'المدينة' : 'City',
      accessor: (row) => row.city?.trim() || '—',
    },
    {
      header: isArabic ? 'شركة الشحن' : 'Carrier',
      accessor: (row) => (
        <OmsCarrierCell
          carrier={row.shippingCarrierName || row.carrier}
          shippingMethod={row.shippingMethod}
          isManualShipping={row.isManualShipping}
          outboundStatus={row.linkedOutboundOrder?.status}
          isArabic={isArabic}
        />
      ),
    },
    {
      header: isArabic ? 'الإجمالي' : 'Total',
      accessor: (row) =>
        row.total ? `${row.total}${row.currency ? ` ${row.currency}` : ''}` : '—',
    },
    {
      header: isArabic ? 'الحالة' : 'Status',
      accessor: (row) => (
        <OmsStatusBadge status={row.status} isArabic={isArabic} needsInformation={row.needsInformation} />
      ),
    },
    ...(shouldShowOmsStageColumn(appliedFilters.status)
      ? [
          {
            header: isArabic ? 'المرحلة' : 'Stage',
            accessor: (row: OmsOrderListItem) => {
              const stage = orderOperationalStage(row);
              if (!stage) return <span className="text-text-muted">—</span>;
              return <OmsStageBadge order={row} isArabic={isArabic} />;
            },
          },
        ]
      : []),
    {
      header: isArabic ? 'الإجراءات' : 'Actions',
      accessor: (row) => {
        const outboundId = row.outboundOrderId ?? row.linkedOutboundOrder?.id;
        const outboundStatus = row.linkedOutboundOrder?.status;

        const actionItems: Array<{
          key: string;
          label: string;
          onClick: () => void;
          danger?: boolean;
        }> = [];

        // 1. Waiting for confirmation: Confirm & Cancel
        if (row.status === 'waiting_for_confirmation') {
          actionItems.push(
            {
              key: 'confirm',
              label: isArabic ? 'تأكيد الطلب' : 'Confirm',
              onClick: () => confirmSingleMut.mutate(row.id),
            },
            {
              key: 'cancel',
              label: isArabic ? 'إلغاء الطلب' : 'Cancel',
              danger: true,
              onClick: () => setSingleCancelOrder(row),
            },
          );
        }

        // 2. Confirmed waiting for admin approval: Approve (if not needsInfo) & Cancel
        if (
          row.status === 'confirmed_waiting_for_admin_approval' ||
          row.status === 'pending_approval' ||
          row.status === 'pending'
        ) {
          if (!row.needsInformation) {
            actionItems.push({
              key: 'approve',
              label: isArabic ? 'اعتماد الطلب' : 'Approve',
              onClick: () => approveSingleMut.mutate(row.id),
            });
          }
          actionItems.push({
            key: 'cancel',
            label: isArabic ? 'إلغاء الطلب' : 'Cancel',
            danger: true,
            onClick: () => setSingleCancelOrder(row),
          });
        }

        // 3. Processing: print worker instructions, then stage actions
        if (mapOmsCommercialDisplayStatus(row.status) === 'processing') {
          actionItems.push({
            key: 'instructionsPdf',
            label: isArabic ? 'تعليمات التنفيذ PDF' : 'Instructions PDF',
            onClick: () => void handleDownloadInstructions(row),
          });
        }

        if (row.status === 'processing' && outboundId) {
          if (
            outboundStatus === 'picking' ||
            outboundStatus === 'draft' ||
            outboundStatus === 'allocated' ||
            outboundStatus === 'pending_approval' ||
            outboundStatus === 'confirmed' ||
            outboundStatus === 'pending_stock'
          ) {
            actionItems.push({
              key: 'completePicking',
              label: isArabic ? 'إكمال مرحلة الالتقاط' : 'Mark Picking as Complete',
              onClick: () => completePickingSingleMut.mutate(outboundId),
            });
          } else if (outboundStatus === 'packing') {
            actionItems.push({
              key: 'completePacking',
              label: isArabic ? 'إكمال مرحلة التعبئة' : 'Mark Packing as Complete',
              onClick: () => completePackingSingleMut.mutate(outboundId),
            });
          } else if (
            outboundStatus === 'waiting_for_shipping_method' ||
            outboundStatus === 'waiting_for_shipping_details'
          ) {
            const hasShipmentSent = Boolean(
              row.trackingNumber?.trim() ||
              row.linkedOutboundOrder?.trackingNumber?.trim() ||
              row.linkedOutboundOrder?.hasCarrierShipment,
            );

            if (hasShipmentSent) {
              actionItems.push({
                key: 'confirmShippingComplete',
                label: isArabic ? 'تأكيد اكتمال الشحن' : 'Confirm Shipping Complete',
                onClick: () => completeShippingDetailsSingleMut.mutate(outboundId),
              });
            } else {
              actionItems.push({
                key: 'completeShipping',
                label: isArabic ? 'إكمال تفاصيل الشحن' : 'Complete Shipping Details',
                onClick: () => setSingleShippingOrder(row),
              });
            }
          }
        }

        // 4. Ready to ship: Mark Dispatch Complete
        if (row.status === 'ready_to_ship' && outboundId) {
          actionItems.push({
            key: 'completeDispatch',
            label: isArabic ? 'إكمال الإرسال والخروج للتسليم' : 'Mark Dispatch as Complete',
            onClick: () => completeDispatchSingleMut.mutate(outboundId),
          });
        }

        // 5. Out for delivery (or shipped) or failed delivery
        if (row.status === 'shipped' || row.status === 'out_for_delivery') {
          actionItems.push(
            {
              key: 'markDelivered',
              label: isArabic ? 'تم التسليم بنجاح' : 'Mark as Delivered',
              onClick: () => markDeliveredSingleMut.mutate(row.id),
            },
            {
              key: 'markFailedDelivery',
              label: isArabic ? 'تعذر التسليم' : 'Mark as Failed Delivery',
              danger: true,
              onClick: () => markFailedDeliverySingleMut.mutate(row.id),
            },
          );
        } else if (row.status === 'failed_delivery') {
          actionItems.push({
            key: 'markReturned',
            label: isArabic ? 'تحويل لمرتجع' : 'Mark as Return',
            danger: true,
            onClick: () => markReturnedSingleMut.mutate(row.id),
          });
        }

        // Generic cancellable fallback (for processing or other cancellable stages)
        if (
          isOmsAdminCancellableStatus(row.status) &&
          row.status !== 'cancelled' &&
          row.status !== 'waiting_for_confirmation' &&
          row.status !== 'confirmed_waiting_for_admin_approval' &&
          row.status !== 'pending_approval' &&
          row.status !== 'pending'
        ) {
          actionItems.push({
            key: 'cancel',
            label: isArabic ? 'إلغاء الطلب' : 'Cancel',
            danger: true,
            onClick: () => setSingleCancelOrder(row),
          });
        }

        // Edit
        actionItems.push({
          key: 'edit',
          label: isArabic ? 'تعديل' : 'Edit',
          onClick: () => setEditOrderId(row.id),
        });

        // Waybill: ONLY if canOrderHaveWaybill(row) is true!
        if (canOrderHaveWaybill(row)) {
          actionItems.push({
            key: 'waybill',
            label: isArabic ? 'بوليصة الشحن (طباعة / PDF)' : 'Shipping Waybill (Print / PDF)',
            onClick: () => setWaybillOrderId(row.id),
          });
        }

        if (row.status === 'delivered' || row.status === 'completed') {
          actionItems.push({
            key: 'shippingFee',
            label: isArabic ? 'تحديد رسوم الشحن' : 'Specify shipping fee',
            onClick: () =>
              navigate(`/orders/oms/${row.id}`, { state: { openShippingFee: true } }),
          });
        }

        if (isOmsOrderDeletable(row.status)) {
          actionItems.push({
            key: 'delete',
            label: isArabic ? 'حذف' : 'Delete',
            danger: true,
            onClick: () => setDeleteOrder(row),
          });
        }

        return (
          <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
            <RowActionsMenu ariaLabel="Open actions" items={actionItems} />
          </div>
        );
      },
    },
  ];

  return (
    <AdminListPageShell
      icon="fa-cart-shopping"
      title="OMS Orders"
      subtitle="Manage ecommerce and OMS fulfillment orders."
      isArabic={isArabic}
      navActions={navActions}
    >
      <AdvancedFilterSection
        advancedOpen={advancedOpen}
        onAdvancedOpenChange={setAdvancedOpen}
        activeCount={advancedActiveCount}
        summary={appliedSummary}
        isArabic={isArabic}
        loading={pagination.isFetching}
        applyDisabled={Boolean(draftRangeError)}
        onApply={onApplyFilters}
        onReset={onResetFilters}
        compact={
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="relative min-w-0 flex-1 sm:max-w-md">
              <i
                className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-xs text-text-faint"
                aria-hidden
              />
              <input
                value={draftFilters.orderSearch}
                onChange={(e) => setDraft({ orderSearch: e.target.value })}
                placeholder={
                  isArabic
                    ? 'بحث: رقم الطلب، العملاء، الزبائن، الهاتف…'
                    : 'Search orders, clients, customers, phone...'
                }
                aria-label={isArabic ? 'بحث سريع' : 'Quick search'}
                className={FILTER_COMPACT_SEARCH_CLASS}
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setScanSearchOpen(true)}
              title={isArabic ? 'مسح QR بوليصة الشحن للبحث' : 'Scan Waybill QR to Search'}
              className="h-9 shrink-0 gap-1.5 border-brand-500/30 text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-950/40"
            >
              <i className="fa-solid fa-qrcode text-xs text-brand-600 dark:text-brand-400" aria-hidden="true" />
              <span>{isArabic ? 'مسح QR' : 'Scan QR'}</span>
            </Button>
          </div>
        }
      >
        <div className="min-w-0">
          <FilterFieldLabel>{isArabic ? 'رقم الطلب' : 'Order ID'}</FilterFieldLabel>
          <input
            value={draftFilters.orderId}
            onChange={(e) => setDraft({ orderId: e.target.value })}
            placeholder={isArabic ? 'رقم الطلب أو المرجع…' : 'Order # or reference…'}
            className={FILTER_FIELD_CONTROL_CLASS}
          />
        </div>
        <div className="min-w-0">
          <FilterFieldLabel>{isArabic ? 'رقم طلب البداية' : 'Start Order No.'}</FilterFieldLabel>
          <input
            value={draftFilters.startOrderNo}
            onChange={(e) => setDraft({ startOrderNo: e.target.value })}
            placeholder="OMS-2026-03700"
            className={FILTER_FIELD_CONTROL_CLASS}
          />
        </div>
        <div className="min-w-0">
          <FilterFieldLabel>{isArabic ? 'رقم طلب النهاية' : 'End Order No.'}</FilterFieldLabel>
          <input
            value={draftFilters.endOrderNo}
            onChange={(e) => setDraft({ endOrderNo: e.target.value })}
            placeholder="OMS-2026-03800"
            className={FILTER_FIELD_CONTROL_CLASS}
          />
        </div>
        {draftRangeError ? (
          <div className="col-span-full rounded-lg border border-status-error-border bg-status-error-bg p-2.5 text-xs font-medium text-status-error-fg flex items-center gap-2">
            <i className="fa-solid fa-circle-exclamation text-sm shrink-0" aria-hidden="true" />
            <span>{draftRangeError}</span>
          </div>
        ) : null}
        <div className="min-w-0">
          <Combobox
            label={isArabic ? 'العميل' : 'Client'}
            value={draftFilters.companyId}
            onChange={(value) => setDraft({ companyId: value })}
            options={clientOptions}
            placeholder={isArabic ? 'ابحث عن عميل…' : 'Search client…'}
          />
        </div>
        <div className="min-w-0">
          <FilterFieldLabel>{isArabic ? 'الزبون' : 'Customer'}</FilterFieldLabel>
          <input
            value={draftFilters.customer}
            onChange={(e) => setDraft({ customer: e.target.value })}
            placeholder={isArabic ? 'اسم الزبون…' : 'Customer name…'}
            className={FILTER_FIELD_CONTROL_CLASS}
          />
        </div>
        <div className="min-w-0">
          <FilterFieldLabel>{isArabic ? 'الهاتف' : 'Phone'}</FilterFieldLabel>
          <input
            value={draftFilters.phone}
            onChange={(e) => setDraft({ phone: e.target.value })}
            placeholder={isArabic ? 'رقم الهاتف…' : 'Phone…'}
            className={FILTER_FIELD_CONTROL_CLASS}
          />
        </div>
        <div className="min-w-0">
          <FilterFieldLabel>{isArabic ? 'المدينة' : 'City'}</FilterFieldLabel>
          <input
            value={draftFilters.city}
            onChange={(e) => setDraft({ city: e.target.value })}
            placeholder={isArabic ? 'المدينة…' : 'City…'}
            className={FILTER_FIELD_CONTROL_CLASS}
          />
        </div>
        <div className="min-w-0">
          <FilterFieldLabel>{isArabic ? 'تاريخ الإنشاء من' : 'Created from'}</FilterFieldLabel>
          <input
            type="date"
            value={draftFilters.createdFrom}
            onChange={(e) => setDraft({ createdFrom: e.target.value })}
            className={FILTER_FIELD_CONTROL_CLASS}
          />
        </div>
        <div className="min-w-0">
          <FilterFieldLabel>{isArabic ? 'تاريخ الإنشاء إلى' : 'Created to'}</FilterFieldLabel>
          <input
            type="date"
            value={draftFilters.createdTo}
            onChange={(e) => setDraft({ createdTo: e.target.value })}
            className={FILTER_FIELD_CONTROL_CLASS}
          />
        </div>
        <div className="min-w-0">
          <Combobox
            label={isArabic ? 'شركة الشحن' : 'Carrier'}
            value={draftFilters.carrier}
            onChange={(value) => setDraft({ carrier: value })}
            options={carrierOptions}
            placeholder={isArabic ? 'اختر شركة الشحن…' : 'Select carrier…'}
          />
        </div>
        <div className="min-w-0">
          <FilterFieldLabel>{isArabic ? 'الإجمالي / التكلفة' : 'Total / Cost'}</FilterFieldLabel>
          <div className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] gap-2">
            <select
              value={draftFilters.totalOp || 'gte'}
              onChange={(e) => setDraft({ totalOp: e.target.value as OmsTotalOperator })}
              aria-label={isArabic ? 'عامل الإجمالي' : 'Total operator'}
              className={FILTER_FIELD_CONTROL_CLASS}
            >
              {OMS_TOTAL_OPERATOR_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              value={draftFilters.totalValue}
              onChange={(e) => setDraft({ totalValue: e.target.value })}
              placeholder="0"
              aria-label={isArabic ? 'قيمة الإجمالي' : 'Total value'}
              className={FILTER_FIELD_CONTROL_CLASS}
            />
          </div>
        </div>
      </AdvancedFilterSection>

      <OmsOrdersStatusNav
        isArabic={isArabic}
        status={appliedFilters.status}
        operationalStage={appliedFilters.operationalStage}
        counts={navCountsQuery.data}
        onStatusChange={(status) => applyPatch({ status, operationalStage: '' })}
        onStageChange={(operationalStage) => applyPatch({ operationalStage })}
      />

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border-subtle bg-surface px-3 py-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setStatusScan('confirm')}
          className="gap-1.5"
        >
          <i className="fa-solid fa-qrcode text-xs" aria-hidden="true" />
          <span>{isArabic ? 'تأكيد بالـ QR' : 'Confirm by QR'}</span>
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setStatusScan('approve')}
          className="gap-1.5"
        >
          <i className="fa-solid fa-qrcode text-xs" aria-hidden="true" />
          <span>{isArabic ? 'اعتماد بالـ QR' : 'Approve by QR'}</span>
        </Button>
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={() => setStatusScan('handover')}
          className="gap-1.5"
        >
          <i className="fa-solid fa-qrcode text-xs" aria-hidden="true" />
          <span>{isArabic ? 'تسليم بالـ QR' : 'Handover by QR'}</span>
        </Button>
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={() => setStatusScan('delivered')}
          className="gap-1.5"
        >
          <i className="fa-solid fa-qrcode text-xs" aria-hidden="true" />
          <span>{isArabic ? 'تم التسليم بالـ QR' : 'Delivered by QR'}</span>
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setStatusScan('failed')}
          className="gap-1.5 border-rose-300 text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-300 dark:hover:bg-rose-950/40"
        >
          <i className="fa-solid fa-qrcode text-xs" aria-hidden="true" />
          <span>{isArabic ? 'تعذر التسليم بالـ QR' : 'Failed delivery by QR'}</span>
        </Button>
        <span className="text-xs text-text-muted">
          {isArabic
            ? 'اختر الإجراء ثم امسح بوليصة الطلب. يُسمح فقط بالانتقال التالي الصحيح للحالة الحالية.'
            : 'Choose an action, then scan the order waybill. Only the next valid transition for the current status is allowed.'}
        </span>
      </div>

      {/* ─── Selected Orders Bulk Quick Actions Toolbar (under status navbar) ─── */}
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-xl bg-surface-sunken p-1.5 border border-border-subtle/70 shadow-xs animate-enter">
          <div className="flex items-center gap-2 px-2.5 py-1 text-sm font-medium text-text-strong">
            <span className="inline-flex h-5 min-w-[1.25rem] px-1.5 items-center justify-center rounded-full bg-primary text-white text-xs font-bold shadow-xs">
              {selectedIds.size}
            </span>
            <span className="whitespace-nowrap">
              {isArabic
                ? `تم تحديد ${selectedIds.size} طلب`
                : `${selectedIds.size} selected`}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                if (selectedIds.size > 1000) {
                  toast.error(
                    isArabic
                      ? 'يمكن إنشاء مجموعة من حتى 1000 طلب في المرة الواحدة.'
                      : 'You can create a batch with up to 1000 orders at once.',
                  );
                  return;
                }
                setCreateBatchOpen(true);
              }}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-emerald-700 bg-white px-3.5 py-1.5 text-xs font-semibold text-emerald-800 shadow-xs"
            >
              <i className="fa-solid fa-layer-group text-[11px]" aria-hidden="true" />
              <span>{isArabic ? 'إنشاء مجموعة' : 'Create batch'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (selectedIds.size > 1000) {
                  toast.error(
                    isArabic
                      ? 'يمكن إضافة حتى 1000 طلب إلى مجموعة في المرة الواحدة.'
                      : 'You can add up to 1000 orders to a batch at once.',
                  );
                  return;
                }
                setAddToBatchOpen(true);
              }}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-emerald-700 bg-white px-3.5 py-1.5 text-xs font-semibold text-emerald-800 shadow-xs"
            >
              <i className="fa-solid fa-folder-plus text-[11px]" aria-hidden="true" />
              <span>{isArabic ? 'إضافة إلى مجموعة موجودة' : 'Add to existing batch'}</span>
            </button>
            {SHOW_LEGACY_BULK_STAGE_ACTIONS && (
              <>
            {waitingConfirmOrders.length > 0 && (
              <button
                type="button"
                disabled={!!loadingAction}
                onClick={() => void handleBulkConfirm()}
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all shadow-xs bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
              >
                <i className="fa-solid fa-check-double text-[11px]" aria-hidden="true" />
                <span>
                  {isArabic
                    ? `تأكيد الكل (${waitingConfirmOrders.length})`
                    : `Confirm All (${waitingConfirmOrders.length})`}
                </span>
              </button>
            )}

            {waitingApprovalOrders.length > 0 && (
              <button
                type="button"
                disabled={!!loadingAction}
                onClick={() => void handleBulkApprove()}
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all shadow-xs bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
              >
                <i className="fa-solid fa-stamp text-[11px]" aria-hidden="true" />
                <span>
                  {isArabic
                    ? `اعتماد الكل (${waitingApprovalOrders.length})`
                    : `Approve All (${waitingApprovalOrders.length})`}
                </span>
              </button>
            )}

            {pickingEligibleOrders.length > 0 && (
              <button
                type="button"
                disabled={!!loadingAction}
                onClick={() => void handleBulkCompletePicking()}
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all shadow-xs bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
              >
                <i className="fa-solid fa-hand-holding-box text-[11px]" aria-hidden="true" />
                <span>
                  {isArabic
                    ? `إكمال الالتقاط (${pickingEligibleOrders.length})`
                    : `Complete Picking (${pickingEligibleOrders.length})`}
                </span>
              </button>
            )}

            {packingEligibleOrders.length > 0 && (
              <button
                type="button"
                disabled={!!loadingAction}
                onClick={() => void handleBulkCompletePacking()}
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all shadow-xs bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50"
              >
                <i className="fa-solid fa-box-open text-[11px]" aria-hidden="true" />
                <span>
                  {isArabic
                    ? `إكمال التعبئة (${packingEligibleOrders.length})`
                    : `Complete Packing (${packingEligibleOrders.length})`}
                </span>
              </button>
            )}

            {shippingDetailsEligibleOrders.length > 0 && (
              <button
                type="button"
                disabled={!!loadingAction}
                onClick={handleBulkShippingDetails}
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all shadow-xs bg-amber-100 hover:bg-amber-200 dark:bg-amber-950/60 dark:hover:bg-amber-900/60 border border-amber-300 dark:border-amber-700/80 text-amber-900 dark:text-amber-200 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <i className="fa-solid fa-truck-ramp-box text-[11px] text-amber-800 dark:text-amber-300" aria-hidden="true" />
                <span>
                  {isArabic
                    ? `تفاصيل الشحن (${shippingDetailsEligibleOrders.length})`
                    : `Shipping Details (${shippingDetailsEligibleOrders.length})`}
                </span>
              </button>
            )}

            {shippingConfirmEligibleOrders.length > 0 && (
              <button
                type="button"
                disabled={isBulkCompletingShipping || !!loadingAction}
                onClick={() => void handleBulkConfirmShippingComplete()}
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all shadow-xs bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
              >
                <i className="fa-solid fa-check-double text-[11px]" aria-hidden="true" />
                <span>
                  {isArabic
                    ? `تأكيد اكتمال الشحن (${shippingConfirmEligibleOrders.length})`
                    : `Confirm Shipping (${shippingConfirmEligibleOrders.length})`}
                </span>
              </button>
            )}

            {dispatchEligibleOrders.length > 0 && (
              <button
                type="button"
                disabled={!!loadingAction}
                onClick={() => void handleBulkCompleteDispatch()}
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all shadow-xs bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-50"
              >
                <i className="fa-solid fa-truck-arrow-right text-[11px]" aria-hidden="true" />
                <span>
                  {isArabic
                    ? `إكمال الإرسال (${dispatchEligibleOrders.length})`
                    : `Complete Dispatch (${dispatchEligibleOrders.length})`}
                </span>
              </button>
            )}

            {deliveryEligibleOrders.length > 0 && (
              <>
                <button
                  type="button"
                  disabled={!!loadingAction}
                  onClick={() => void handleBulkDelivered()}
                  className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all shadow-xs bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
                >
                  <i className="fa-solid fa-circle-check text-[11px]" aria-hidden="true" />
                  <span>
                    {isArabic
                      ? `تم التسليم (${deliveryEligibleOrders.length})`
                      : `Mark Delivered (${deliveryEligibleOrders.length})`}
                  </span>
                </button>
                <button
                  type="button"
                  disabled={!!loadingAction}
                  onClick={() => void handleBulkFailedDelivery()}
                  className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all shadow-xs bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-50"
                >
                  <i className="fa-solid fa-triangle-exclamation text-[11px]" aria-hidden="true" />
                  <span>
                    {isArabic
                      ? `تعذر التسليم (${deliveryEligibleOrders.length})`
                      : `Failed Delivery (${deliveryEligibleOrders.length})`}
                  </span>
                </button>
              </>
            )}

            {returnEligibleOrders.length > 0 && (
              <button
                type="button"
                disabled={!!loadingAction}
                onClick={() => void handleBulkReturned()}
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all shadow-xs bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-50"
              >
                <i className="fa-solid fa-rotate-left text-[11px]" aria-hidden="true" />
                <span>
                  {isArabic
                    ? `تحويل لمرتجع (${returnEligibleOrders.length})`
                    : `Mark as Return (${returnEligibleOrders.length})`}
                </span>
              </button>
            )}

            {cancellableSelectedOrders.length > 0 && (
              <button
                type="button"
                disabled={!!loadingAction}
                onClick={() => setBulkCancelConfirmOpen(true)}
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all shadow-xs border border-rose-300 text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-300 dark:hover:bg-rose-950/30 disabled:opacity-50"
              >
                <i className="fa-solid fa-ban text-[11px]" aria-hidden="true" />
                <span>
                  {isArabic
                    ? `إلغاء الكل (${cancellableSelectedOrders.length})`
                    : `Cancel All (${cancellableSelectedOrders.length})`}
                </span>
              </button>
            )}

            {instructionEligibleOrders.length > 0 && (
              <>
                <button
                  type="button"
                  disabled={!!downloadingInstructions}
                  onClick={() => void handleDownloadInstructionBulk('pdf')}
                  className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all shadow-xs bg-slate-800 hover:bg-slate-900 text-white disabled:opacity-50"
                >
                  <i className="fa-solid fa-file-pdf text-[11px]" aria-hidden="true" />
                  <span>
                    {isArabic
                      ? `تنزيل تعليمات PDF (${instructionEligibleOrders.length})`
                      : `Download instructions PDF (${instructionEligibleOrders.length})`}
                  </span>
                </button>
                <button
                  type="button"
                  disabled={!!downloadingInstructions}
                  onClick={() => void handleDownloadInstructionBulk('zip')}
                  className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all shadow-xs border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 disabled:opacity-50"
                >
                  <i className="fa-solid fa-file-zipper text-[11px]" aria-hidden="true" />
                  <span>
                    {isArabic
                      ? `تنزيل التعليمات ZIP (${instructionEligibleOrders.length})`
                      : `Download instructions ZIP (${instructionEligibleOrders.length})`}
                  </span>
                </button>
              </>
            )}

            {waybillEligibleOrders.length > 0 && (
              <>
                <button
                  type="button"
                  disabled={exportingWaybills}
                  onClick={() => void handleWaybillsPdf('download')}
                  className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all shadow-xs bg-emerald-700 hover:bg-emerald-800 text-white disabled:opacity-50"
                >
                  <i className="fa-solid fa-file-pdf text-[11px]" aria-hidden="true" />
                  <span>
                    {isArabic
                      ? `تحميل البوالص (${waybillEligibleOrders.length})`
                      : `Download waybills (${waybillEligibleOrders.length})`}
                  </span>
                </button>
                <button
                  type="button"
                  disabled={exportingWaybills}
                  onClick={() => void handleWaybillsPdf('print')}
                  className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all shadow-xs border border-emerald-700 bg-white text-emerald-800 disabled:opacity-50"
                >
                  <i className="fa-solid fa-print text-[11px]" aria-hidden="true" />
                  <span>{isArabic ? 'طباعة البوالص' : 'Print waybills'}</span>
                </button>
              </>
            )}

              </>
            )}

            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium text-text-muted hover:text-text-strong hover:bg-white/60 dark:hover:bg-surface-hover/60 transition-all"
            >
              <i className="fa-solid fa-xmark text-[11px]" aria-hidden="true" />
              <span>{isArabic ? 'إلغاء التحديد' : 'Clear selection'}</span>
            </button>
          </div>
        </div>
      )}

      {pagination.isError ? (
        <Card padding="md" className="mb-4 border-status-error-border bg-status-error-bg">
          <p className="text-sm text-status-error-fg">
            {(pagination.error as Error)?.message ||
              (isArabic ? 'تعذر تحميل الطلبات.' : 'Failed to load orders.')}
          </p>
        </Card>
      ) : null}

      <div className="flex flex-wrap items-center justify-end gap-2 text-xs text-text-muted">
        <label htmlFor="oms-orders-page-size" className="font-semibold">
          {isArabic ? 'عدد الصفوف في الصفحة' : 'Rows per page'}
        </label>
        <select
          id="oms-orders-page-size"
          value={pageSizeChoice}
          onChange={(e) => changePageSize(e.target.value)}
          className="h-8 rounded-lg border border-border-subtle bg-surface px-2 text-xs font-medium text-text-strong"
        >
          {PAGE_SIZE_PRESETS.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
          <option value="custom">{isArabic ? 'مخصص' : 'Custom'}</option>
        </select>
        {pageSizeChoice === 'custom' ? (
          <input
            type="number"
            min={1}
            max={MAX_PAGE_SIZE}
            inputMode="numeric"
            value={customPageSize}
            onChange={(e) => onCustomPageSizeChange(e.target.value)}
            placeholder={`1-${MAX_PAGE_SIZE}`}
            aria-label={isArabic ? 'عدد صفوف مخصص (1-1000)' : 'Custom rows per page (1-1000)'}
            className="h-8 w-24 rounded-lg border border-border-subtle bg-surface px-2 text-xs"
          />
        ) : null}
      </div>

      <DataTable
        columns={columns}
        rows={pagination.rows}
        rowKey={(row) => row.id}
        serverPagination={pagination.serverPagination}
        loading={pagination.isInitialLoading}
        empty="No OMS orders match the filters."
        onRowClick={(row) => navigate(`/orders/oms/${row.id}`)}
      />



      {editOrderId ? (
        <OmsOrderFormModal
          open
          mode="edit"
          initial={editDetailQuery.data ?? null}
          onClose={() => setEditOrderId(null)}
          onSaved={() => {
            setEditOrderId(null);
            void qc.invalidateQueries({ queryKey: QK.omsOrders });
          }}
        />
      ) : null}

      <OmsWaybillModal
        open={Boolean(waybillOrderId)}
        orderId={waybillOrderId}
        onClose={() => setWaybillOrderId(null)}
        isArabic={isArabic}
      />

      <OmsOrdersImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => {
          void qc.invalidateQueries({ queryKey: QK.omsOrders });
        }}
      />

      <OmsOrdersExportModal
        open={exportOpen}
        onClose={() => {
          if (!exporting) setExportOpen(false);
        }}
        columns={exportColumns}
        exporting={exporting}
        onExport={(payload) => void onExportSubmit(payload)}
        isArabic={isArabic}
      />

      {/* ─── Bulk Process Modal ───────────────────────────────────────────────── */}
      <OmsBulkExecutionPlanModal
        open={processModalOpen}
        selectedOrders={selectedOrders}
        onClose={() => setProcessModalOpen(false)}
        onConfirm={(items) => void handleProcessConfirm(items)}
        loading={loadingAction === 'process'}
      />

      {/* ─── Single Shipping Modal ───────────────────────────────────────────── */}
      <OmsSingleShippingModal
        open={Boolean(singleShippingOrder)}
        order={singleShippingOrder}
        onClose={() => setSingleShippingOrder(null)}
        onSuccess={() => {
          setSingleShippingOrder(null);
          void qc.invalidateQueries({ queryKey: QK.omsOrders });
        }}
        isArabic={isArabic}
      />

      {/* ─── Bulk Shipping Details Modal ─────────────────────────────────────── */}
      <OmsCreateBatchModal
        open={createBatchOpen}
        selectedIds={Array.from(selectedIds)}
        loadedOrders={pagination.rows}
        isArabic={isArabic}
        onClose={() => setCreateBatchOpen(false)}
      />
      <OmsAddToBatchModal
        open={addToBatchOpen}
        selectedIds={Array.from(selectedIds)}
        isArabic={isArabic}
        onClose={() => setAddToBatchOpen(false)}
      />
      <OmsBulkShippingDetailsModal
        open={shippingDetailsModalOpen}
        selectedOrders={shippingDetailsEligibleOrders}
        onClose={() => setShippingDetailsModalOpen(false)}
        onSuccess={() => {
          setShippingDetailsModalOpen(false);
          void qc.invalidateQueries({ queryKey: QK.omsOrders });
        }}
        isArabic={isArabic}
      />

      {/* ─── Bulk Ship Modal (reuses BulkShippingProcessingModal) ───────────── */}
      <BulkShippingProcessingModal
        open={shipModalOpen}
        outboundOrderIds={shipOutboundIds}
        onClose={() => {
          setShipModalOpen(false);
          void qc.invalidateQueries({ queryKey: QK.omsOrders });
        }}
      />

      {/* ─── Bulk Result Modal ───────────────────────────────────────────────── */}
      {bulkResult && (
        <BulkActionResultModal
          open
          title={bulkResult.title}
          result={bulkResult.result}
          onClose={() => setBulkResult(null)}
        />
      )}

      <ConfirmModal
        open={!!deleteOrder}
        title="Delete OMS order?"
        confirmLabel="Delete"
        danger
        loading={deleteMut.isPending}
        onClose={() => !deleteMut.isPending && setDeleteOrder(null)}
        onConfirm={() => {
          if (deleteOrder) deleteMut.mutate(deleteOrder.id);
        }}
      >
        {deleteOrder
          ? `Delete ${deleteOrder.orderNumber}? This cannot be undone.`
          : null}
      </ConfirmModal>

      {/* ─── Single Order Cancel Confirmation Modal ──────────────────────────── */}
      <ConfirmModal
        open={Boolean(singleCancelOrder)}
        title={
          isArabic
            ? `هل أنت متأكد من إلغاء الطلب ${singleCancelOrder?.orderNumber ?? ''}؟`
            : `Cancel OMS order ${singleCancelOrder?.orderNumber ?? ''}?`
        }
        confirmLabel={isArabic ? 'إلغاء الطلب' : 'Cancel order'}
        cancelLabel={isArabic ? 'تراجع' : 'Keep order'}
        danger
        cancelVariant="success"
        loading={cancelSingleMut.isPending}
        onClose={() => !cancelSingleMut.isPending && setSingleCancelOrder(null)}
        onConfirm={() => singleCancelOrder && cancelSingleMut.mutate(singleCancelOrder.id)}
      >
        <p className="text-sm">
          {isArabic
            ? 'سيتم تحويل حالة الطلب إلى ملغي ولن يتم تنفيذ الشحنة.'
            : 'The order will be marked cancelled in the commercial lifecycle.'}
        </p>
      </ConfirmModal>

      {/* ─── Bulk Cancel Confirmation Modal ──────────────────────────────────── */}
      <ConfirmModal
        open={bulkCancelConfirmOpen}
        title={
          isArabic
            ? `إلغاء ${cancellableSelectedOrders.length} طلب؟`
            : `Cancel ${cancellableSelectedOrders.length} order(s)?`
        }
        confirmLabel={isArabic ? 'إلغاء الطلبات' : 'Cancel orders'}
        cancelLabel={isArabic ? 'تراجع' : 'Keep orders'}
        danger
        cancelVariant="success"
        loading={loadingAction === 'cancel'}
        onClose={() => loadingAction !== 'cancel' && setBulkCancelConfirmOpen(false)}
        onConfirm={() => void handleBulkCancel()}
      >
        <p className="text-sm">
          {isArabic
            ? `سيتم إلغاء كافة الطلبات المحددة القابلة للإلغاء (${cancellableSelectedOrders.length} طلب).`
            : `All selected cancellable orders (${cancellableSelectedOrders.length}) will be marked cancelled.`}
        </p>
      </ConfirmModal>

      {/* ─── Search by QR Code Modal ─────────────────────────────────────────── */}
      <OmsOrderScanSearchModal
        open={scanSearchOpen}
        onClose={() => setScanSearchOpen(false)}
        isArabic={isArabic}
        onScan={(code) => {
          applyPatch({ orderSearch: code });
          toast.success(
            isArabic
              ? `تم تطبيق البحث عن: ${code}`
              : `Filtered orders for: ${code}`,
          );
        }}
      />
      <OmsOrderScanSearchModal
        open={statusScan != null}
        keepOpen
        isArabic={isArabic}
        title={statusScanCopy(statusScan, isArabic).title}
        hint={statusScanCopy(statusScan, isArabic).hint}
        submitLabel={isArabic ? 'تسجيل' : 'Record'}
        onClose={() => setStatusScan(null)}
        onScan={handleWaybillStatusScan}
      />
    </AdminListPageShell>
  );
}
