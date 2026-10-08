import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

import {
  Alert,
  AdvancedFilterSection,
  Button,
  EmptyState,
  ListPageHeader,
  Skeleton,
  StatusBadge,
  countNonEmptyFilters,
  FILTER_COMPACT_SEARCH_CLASS,
  FILTER_FIELD_CONTROL_CLASS,
} from '@ds';
import {
  CHUNK_SIZE_STANDARD,
  useChunkedServerPagination,
} from '../hooks/useChunkedServerPagination';
import { useCachedState } from '../hooks/useCachedState';
import { useFilters } from '../hooks/useFilters';

import { Card } from '../design-v2/Card';
import { StorePillTabs } from '../design-v2/StorePillTabs';
import { TableFooterPagination } from '../design-v2/TableFooterPagination';
import { ClientOrderImportModal } from '../components/ClientOrderImportModal';
import { ClientOmsOrdersExportModal } from '../components/ClientOmsOrdersExportModal';
import { ClientOmsOrdersStatusNav } from '../components/ClientOmsOrdersStatusNav';
import { useClientOperationalAccess } from '../hooks/useClientOperationalAccess';
import {
  clientOmsCommercialStatusBadgeKey,
  clientOmsCommercialStatusLabel,
  mapClientOmsCommercialDisplayStatus,
} from '../lib/client-oms-commercial-status';
import { isClientArabic } from '../lib/client-ui-language';
import { isProductionClientPortal } from '../lib/production-client-portal';
import {
  cancelClientOmsOrdersBulk,
  confirmClientOmsOrdersBulk,
  fetchClientOmsNavCounts,
  fetchClientOmsOrders,
  type ClientOmsOperationalStage,
  type ClientOmsOrderListItem,
  type ClientOmsOrderStatus,
  type ClientOmsTotalOp,
} from '../services/clientOmsOrdersService';
import {
  CLIENT_OMS_EXPORT_COLUMNS,
  downloadClientOrdersExport,
} from '../services/clientOrdersExport';

function labelText(label: string, isArabic: boolean): string {
  if (!isArabic) return label;
  const ar: Record<string, string> = {
    'Online orders': 'الطلبات الإلكترونية',
    'Orders from your store channels': 'طلبات من قنوات متجرك',
    'Create order': 'إنشاء طلب',
    Import: 'استيراد',
    'Confirm orders': 'تأكيد الطلبات',
    'Incomplete Order': 'طلب غير مكتمل',
    'Search order number...': 'ابحث برقم الطلب...',
    'All statuses': 'كل الحالات',
    'Order #': 'رقم الطلب',
    Status: 'الحالة',
    Recipient: 'المستلم',
    City: 'المدينة',
    Channel: 'القناة',
    Total: 'الإجمالي',
    Created: 'تاريخ الإنشاء',
    'No online orders yet': 'لا توجد طلبات إلكترونية بعد',
    'Create an order from your store channel to track it here.':
      'أنشئ طلباً من قناة متجرك لتتبعه هنا.',
    'No online orders match the filters.': 'لا توجد طلبات إلكترونية مطابقة للفلاتر.',
    'Create first order': 'إنشاء أول طلب',
    'Could not load online orders': 'تعذر تحميل الطلبات الإلكترونية',
    Retry: 'إعادة المحاولة',
    'Select order': 'اختر الطلب',
    'Select all confirmable orders': 'تحديد كل الطلبات القابلة للتأكيد',
    'Only orders waiting for confirmation can be confirmed.':
      'يمكن تأكيد الطلبات في حالة بانتظار التأكيد فقط.',
    'Confirmed successfully.': 'تم التأكيد بنجاح.',
    'Some orders could not be confirmed.': 'تعذر تأكيد بعض الطلبات.',
    Cancel: 'إلغاء',
    Export: 'تصدير',
    'Export CSV': 'تصدير CSV',
    'Cancelled successfully.': 'تم الإلغاء بنجاح.',
    'Some orders could not be cancelled.': 'تعذر إلغاء بعض الطلبات.',
    'Select all on this page': 'تحديد الكل في هذه الصفحة',
    selected: 'محدد',
    Customer: 'الزبون',
    'Customer name…': 'اسم الزبون…',
    Phone: 'الهاتف',
    'Phone number…': 'رقم الهاتف…',
    Carrier: 'شركة الشحن',
    'Carrier name…': 'اسم شركة الشحن…',
    'City…': 'المدينة…',
    'Start Order No.': 'رقم طلب البداية',
    'End Order No.': 'رقم طلب النهاية',
    'Total operator': 'مقارنة الإجمالي',
    'Total value': 'قيمة الإجمالي',
    'Operational stage': 'المرحلة التشغيلية',
    'All stages': 'كل المراحل',
    Picking: 'الالتقاط',
    Packing: 'التعبئة',
    'Shipping details': 'تفاصيل الشحن',
    'Shipping confirmation': 'تأكيد الشحن',
    'Created from': 'تاريخ الإنشاء من',
    'Created to': 'تاريخ الإنشاء إلى',
    'Equals (=)': 'يساوي (=)',
    'Greater than (>)': 'أكبر من (>)',
    'At least (≥)': 'على الأقل (≥)',
    'Less than (<)': 'أقل من (<)',
    'At most (≤)': 'على الأكثر (≤)',
    'Start order number must not be after the end order number.':
      'رقم طلب البداية يجب ألا يكون بعد رقم النهاية.',
  };
  return ar[label] ?? label;
}

function isConfirmableOrder(row: ClientOmsOrderListItem): boolean {
  if (row.needsInformation) return false;
  const commercial = mapClientOmsCommercialDisplayStatus(row.status);
  return row.status === 'waiting_for_confirmation' || commercial === 'waiting_for_confirmation';
}

function isCancellableOrder(row: ClientOmsOrderListItem): boolean {
  const commercial = mapClientOmsCommercialDisplayStatus(row.status);
  return row.status === 'waiting_for_confirmation' || commercial === 'waiting_for_confirmation';
}

type EcommerceListFilters = {
  search: string;
  status: string;
  customer: string;
  phone: string;
  city: string;
  startOrderNo: string;
  endOrderNo: string;
  totalOp: string;
  totalValue: string;
  operationalStage: string;
  createdFrom: string;
  createdTo: string;
};

const ECOMMERCE_LIST_FILTERS: EcommerceListFilters = {
  search: '',
  status: '',
  customer: '',
  phone: '',
  city: '',
  startOrderNo: '',
  endOrderNo: '',
  totalOp: 'eq',
  totalValue: '',
  operationalStage: '',
  createdFrom: '',
  createdTo: '',
};

const TOTAL_OP_OPTIONS: Array<{ value: ClientOmsTotalOp; label: string }> = [
  { value: 'eq', label: 'Equals (=)' },
  { value: 'gt', label: 'Greater than (>)' },
  { value: 'gte', label: 'At least (≥)' },
  { value: 'lt', label: 'Less than (<)' },
  { value: 'lte', label: 'At most (≤)' },
];

const STAGE_OPTIONS: Array<{ value: ClientOmsOperationalStage; label: string }> = [
  { value: 'picking', label: 'Picking' },
  { value: 'packing', label: 'Packing' },
  { value: 'shipping_details', label: 'Shipping details' },
  { value: 'shipping_confirmation', label: 'Shipping confirmation' },
];

function trimmed(value: string | undefined): string | undefined {
  const v = (value ?? '').trim();
  return v || undefined;
}

export function EcommerceOrdersPage(): ReactElement {
  const navigate = useNavigate();
  const {
    draftFilters: draftFiltersRaw,
    appliedFilters: appliedFiltersRaw,
    setDraft,
    applyFilters,
    applyPatch,
    resetFilters,
  } = useFilters<EcommerceListFilters>(ECOMMERCE_LIST_FILTERS);
  // Older cached filter entries only had search/status — fill missing keys.
  const draftFilters = useMemo<EcommerceListFilters>(
    () => ({ ...ECOMMERCE_LIST_FILTERS, ...draftFiltersRaw }),
    [draftFiltersRaw],
  );
  const appliedFilters = useMemo<EcommerceListFilters>(
    () => ({ ...ECOMMERCE_LIST_FILTERS, ...appliedFiltersRaw }),
    [appliedFiltersRaw],
  );
  const [advancedOpen, setAdvancedOpen] = useCachedState('advanced-filters-open', false);
  const isArabic = isClientArabic();
  const t = (label: string) => labelText(label, isArabic);
  const billingAccess = useClientOperationalAccess(isArabic);
  const [importOpen, setImportOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const hideImportUi = isProductionClientPortal();
  /** Selection / import / export / bulk APIs — Staging Client Portal only. */
  const allowBulkActions = !isProductionClientPortal();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);

  const draftRangeError = useMemo(() => {
    const start = draftFilters.startOrderNo.trim();
    const end = draftFilters.endOrderNo.trim();
    if (start && end && start.localeCompare(end, undefined, { numeric: true }) > 0) {
      return t('Start order number must not be after the end order number.');
    }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftFilters.startOrderNo, draftFilters.endOrderNo, isArabic]);

  const filterKey = useMemo(() => {
    const totalValue = trimmed(appliedFilters.totalValue);
    return {
      orderSearch: trimmed(appliedFilters.search),
      status: (appliedFilters.status || undefined) as ClientOmsOrderStatus | undefined,
      customer: trimmed(appliedFilters.customer),
      phone: trimmed(appliedFilters.phone),
      city: trimmed(appliedFilters.city),
      startOrderNo: trimmed(appliedFilters.startOrderNo),
      endOrderNo: trimmed(appliedFilters.endOrderNo),
      totalOp: totalValue ? ((appliedFilters.totalOp || 'eq') as ClientOmsTotalOp) : undefined,
      totalValue,
      operationalStage: (appliedFilters.operationalStage || undefined) as
        | ClientOmsOperationalStage
        | undefined,
      createdFrom: trimmed(appliedFilters.createdFrom),
      createdTo: trimmed(appliedFilters.createdTo),
    };
  }, [appliedFilters]);

  /** Nav counts ignore status/stage so cards stay stable while switching status. */
  const navCountParams = useMemo(() => {
    const { status: _status, operationalStage: _stage, ...rest } = filterKey;
    return rest;
  }, [filterKey]);

  const navCountsQuery = useQuery({
    queryKey: ['client', 'ecommerce-orders', 'nav-counts', navCountParams],
    queryFn: () => fetchClientOmsNavCounts(navCountParams),
  });

  const pagination = useChunkedServerPagination<ClientOmsOrderListItem>({
    chunkSize: CHUNK_SIZE_STANDARD,
    filterKey,
    fetchChunk: (offset, limit) => fetchClientOmsOrders({ ...filterKey, offset, limit }),
    rtQueryKeyPrefix: ['client', 'ecommerce-orders'],
    chunkQueryKeyPrefix: 'client-ecommerce-orders-chunk',
  });

  const rows = pagination.rows as ClientOmsOrderListItem[];
  const pageIds = useMemo(() => rows.map((r) => r.id), [rows]);

  useEffect(() => {
    setSelectedIds(new Set());
    setBulkMessage(null);
    setBulkError(null);
  }, [JSON.stringify(filterKey), pagination.page]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedConfirmableIds = useMemo(
    () =>
      rows
        .filter((r) => selectedIds.has(r.id) && isConfirmableOrder(r))
        .map((r) => r.id),
    [rows, selectedIds],
  );
  const selectedCancellableIds = useMemo(
    () =>
      rows
        .filter((r) => selectedIds.has(r.id) && isCancellableOrder(r))
        .map((r) => r.id),
    [rows, selectedIds],
  );

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

  const confirmBulkMut = useMutation({
    mutationFn: () => confirmClientOmsOrdersBulk(selectedConfirmableIds),
    onSuccess: (result) => {
      setSelectedIds(new Set());
      void pagination.refetch();
      void navCountsQuery.refetch();
      if (result.failed > 0) {
        const first = result.failures[0];
        setBulkError(
          `${t('Some orders could not be confirmed.')} ${
            first
              ? `${first.orderNumber ?? first.id}: ${first.error}`
              : `(${result.failed}/${result.requested})`
          }`,
        );
        setBulkMessage(
          result.confirmed > 0
            ? `${t('Confirmed successfully.')} ${result.confirmed}/${result.requested}`
            : null,
        );
      } else {
        setBulkError(null);
        setBulkMessage(
          `${t('Confirmed successfully.')} ${result.confirmed}/${result.requested}`,
        );
      }
    },
    onError: (err: Error) => {
      setBulkMessage(null);
      setBulkError(err.message);
    },
  });

  const cancelBulkMut = useMutation({
    mutationFn: () => cancelClientOmsOrdersBulk(selectedCancellableIds),
    onSuccess: (result) => {
      setSelectedIds(new Set());
      void pagination.refetch();
      void navCountsQuery.refetch();
      if (result.failed > 0) {
        const first = result.failures[0];
        setBulkError(
          `${t('Some orders could not be cancelled.')} ${
            first
              ? `${first.orderNumber ?? first.id}: ${first.error}`
              : `(${result.failed}/${result.requested})`
          }`,
        );
        setBulkMessage(
          result.cancelled > 0
            ? `${t('Cancelled successfully.')} ${result.cancelled}/${result.requested}`
            : null,
        );
      } else {
        setBulkError(null);
        setBulkMessage(
          `${t('Cancelled successfully.')} ${result.cancelled}/${result.requested}`,
        );
      }
    },
    onError: (err: Error) => {
      setBulkMessage(null);
      setBulkError(err.message);
    },
  });

  const onExportSubmit = async (payload: { columnIds: string[]; arabicHeaders: boolean }) => {
    if (exporting) return;
    setExporting(true);
    setExportError(null);
    try {
      const ids = selectedIds.size > 0 ? Array.from(selectedIds) : undefined;
      await downloadClientOrdersExport('oms', {
        ...payload,
        ids,
        orderSearch: ids ? undefined : filterKey.orderSearch,
        status: ids ? undefined : filterKey.status,
      });
      setExportOpen(false);
      setBulkMessage(null);
      setBulkError(null);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Export failed.');
    } finally {
      setExporting(false);
    }
  };

  const hasActiveFilters = countNonEmptyFilters(appliedFilters, [
    'search',
    'status',
    'customer',
    'phone',
    'city',
    'startOrderNo',
    'endOrderNo',
    'totalValue',
    'operationalStage',
    'createdFrom',
    'createdTo',
  ]) > 0;

  const createButton = (
    <div className="flex flex-wrap items-center gap-2">
      {allowBulkActions ? (
        <Button
          variant="secondary"
          size="md"
          disabled={exporting}
          onClick={() => {
            setExportError(null);
            setExportOpen(true);
          }}
          startIcon={<i className="fa-solid fa-file-export text-xs" aria-hidden="true" />}
        >
          {t('Export')}
        </Button>
      ) : null}
      {!hideImportUi ? (
        <Button
          variant="secondary"
          size="md"
          disabled={!billingAccess.operationalAllowed}
          title={billingAccess.operationalAllowed ? undefined : billingAccess.actionBlockedReason}
          onClick={() => setImportOpen(true)}
          startIcon={<i className="fa-solid fa-file-import text-xs" aria-hidden="true" />}
        >
          {t('Import')}
        </Button>
      ) : null}
      <Button
        variant="primary"
        size="md"
        disabled={!billingAccess.operationalAllowed}
        title={billingAccess.operationalAllowed ? undefined : billingAccess.actionBlockedReason}
        onClick={() => navigate('/ecommerce-orders/new')}
        startIcon={<i className="fa-solid fa-plus text-xs" aria-hidden="true" />}
      >
        {t('Create order')}
      </Button>
    </div>
  );

  return (
    <div className="space-y-5 animate-enter">
      <ListPageHeader
        icon="fa-cart-shopping"
        title={t('Online orders')}
        subtitle={t('Orders from your store channels')}
        actions={createButton}
      />

      {!hideImportUi ? (
        <ClientOrderImportModal
          kind="oms"
          open={importOpen}
          onClose={() => setImportOpen(false)}
          onImported={() => pagination.refetch()}
          disabled={!billingAccess.operationalAllowed}
          disabledReason={billingAccess.actionBlockedReason}
        />
      ) : null}

      {allowBulkActions ? (
        <ClientOmsOrdersExportModal
          open={exportOpen}
          onClose={() => {
            if (!exporting) setExportOpen(false);
          }}
          columns={CLIENT_OMS_EXPORT_COLUMNS}
          exporting={exporting}
          onExport={(payload) => void onExportSubmit(payload)}
          isArabic={isArabic}
          errorMessage={exportError}
        />
      ) : null}

      <StorePillTabs isArabic={isArabic} />

      {pagination.isError ? (
        <Alert variant="error" title={t('Could not load online orders')}>
          <Alert.Action variant="error" onClick={() => pagination.refetch()}>
            {t('Retry')}
          </Alert.Action>
        </Alert>
      ) : null}

      {bulkError ? <Alert variant="error">{bulkError}</Alert> : null}
      {bulkMessage ? <Alert variant="success">{bulkMessage}</Alert> : null}

      <AdvancedFilterSection
        advancedOpen={advancedOpen}
        onAdvancedOpenChange={setAdvancedOpen}
        isArabic={isArabic}
        loading={pagination.isFetching}
        activeCount={countNonEmptyFilters(appliedFilters, [
          'customer',
          'phone',
          'city',
          'startOrderNo',
          'endOrderNo',
          'totalValue',
          'operationalStage',
          'createdFrom',
          'createdTo',
        ])}
        applyDisabled={Boolean(draftRangeError)}
        onApply={applyFilters}
        onReset={() => {
          resetFilters();
          setAdvancedOpen(false);
        }}
        compact={
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative min-w-0 flex-1 sm:max-w-sm">
              <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-text-faint text-xs" />
              <input
                value={draftFilters.search}
                onChange={(e) => setDraft({ search: e.target.value })}
                placeholder={t('Search order number...')}
                className={FILTER_COMPACT_SEARCH_CLASS}
              />
            </div>
          </div>
        }
      >
        <div className="min-w-0">
          <label className="mb-1 block text-xs font-semibold text-text-muted">{t('Order #')}</label>
          <input
            value={draftFilters.search}
            onChange={(e) => setDraft({ search: e.target.value })}
            placeholder={t('Search order number...')}
            className={FILTER_FIELD_CONTROL_CLASS}
          />
        </div>
        <div className="min-w-0">
          <label className="mb-1 block text-xs font-semibold text-text-muted">{t('Start Order No.')}</label>
          <input
            value={draftFilters.startOrderNo}
            onChange={(e) => setDraft({ startOrderNo: e.target.value })}
            placeholder="OMS-2026-03700"
            className={FILTER_FIELD_CONTROL_CLASS}
          />
        </div>
        <div className="min-w-0">
          <label className="mb-1 block text-xs font-semibold text-text-muted">{t('End Order No.')}</label>
          <input
            value={draftFilters.endOrderNo}
            onChange={(e) => setDraft({ endOrderNo: e.target.value })}
            placeholder="OMS-2026-03800"
            className={FILTER_FIELD_CONTROL_CLASS}
          />
          {draftRangeError ? (
            <p className="mt-1 text-xs text-status-error-fg">{draftRangeError}</p>
          ) : null}
        </div>
        <div className="min-w-0">
          <label className="mb-1 block text-xs font-semibold text-text-muted">{t('Customer')}</label>
          <input
            value={draftFilters.customer}
            onChange={(e) => setDraft({ customer: e.target.value })}
            placeholder={t('Customer name…')}
            className={FILTER_FIELD_CONTROL_CLASS}
          />
        </div>
        <div className="min-w-0">
          <label className="mb-1 block text-xs font-semibold text-text-muted">{t('Phone')}</label>
          <input
            value={draftFilters.phone}
            onChange={(e) => setDraft({ phone: e.target.value })}
            placeholder={t('Phone number…')}
            inputMode="tel"
            className={FILTER_FIELD_CONTROL_CLASS}
          />
        </div>
        <div className="min-w-0">
          <label className="mb-1 block text-xs font-semibold text-text-muted">{t('City')}</label>
          <input
            value={draftFilters.city}
            onChange={(e) => setDraft({ city: e.target.value })}
            placeholder={t('City…')}
            className={FILTER_FIELD_CONTROL_CLASS}
          />
        </div>
        <div className="min-w-0">
          <label className="mb-1 block text-xs font-semibold text-text-muted">{t('Total value')}</label>
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
            <select
              value={draftFilters.totalOp}
              onChange={(e) => setDraft({ totalOp: e.target.value })}
              aria-label={t('Total operator')}
              className={FILTER_FIELD_CONTROL_CLASS}
            >
              {TOTAL_OP_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {t(opt.label)}
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
              aria-label={t('Total value')}
              className={FILTER_FIELD_CONTROL_CLASS}
            />
          </div>
        </div>
        <div className="min-w-0">
          <label className="mb-1 block text-xs font-semibold text-text-muted">{t('Operational stage')}</label>
          <select
            value={draftFilters.operationalStage}
            onChange={(e) => setDraft({ operationalStage: e.target.value })}
            className={FILTER_FIELD_CONTROL_CLASS}
          >
            <option value="">{t('All stages')}</option>
            {STAGE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {t(opt.label)}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-0">
          <label className="mb-1 block text-xs font-semibold text-text-muted">{t('Created from')}</label>
          <input
            type="date"
            value={draftFilters.createdFrom}
            onChange={(e) => setDraft({ createdFrom: e.target.value })}
            className={FILTER_FIELD_CONTROL_CLASS}
          />
        </div>
        <div className="min-w-0">
          <label className="mb-1 block text-xs font-semibold text-text-muted">{t('Created to')}</label>
          <input
            type="date"
            value={draftFilters.createdTo}
            onChange={(e) => setDraft({ createdTo: e.target.value })}
            className={FILTER_FIELD_CONTROL_CLASS}
          />
        </div>
      </AdvancedFilterSection>

      <ClientOmsOrdersStatusNav
        isArabic={isArabic}
        status={appliedFilters.status}
        counts={navCountsQuery.data}
        onStatusChange={(status) => applyPatch({ status })}
      />

      <Card className="overflow-hidden">
        {pagination.isInitialLoading ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-card-muted text-xs uppercase text-text-muted font-semibold">
                <tr>
                  {allowBulkActions ? <th className="w-10 px-3 py-3" /> : null}
                  <th className="px-5 py-3 text-left">{t('Order #')}</th>
                  <th className="px-5 py-3 text-left">{t('Status')}</th>
                  <th className="px-5 py-3 text-left">{t('Recipient')}</th>
                  <th className="px-5 py-3 text-left">{t('Total')}</th>
                  <th className="px-5 py-3 text-right">{t('Created')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {Array.from({ length: 6 }).map((_, rowIdx) => (
                  <tr key={`sk-${rowIdx}`}>
                    {Array.from({ length: allowBulkActions ? 6 : 5 }).map((__, colIdx) => (
                      <td key={colIdx} className="px-5 py-3.5">
                        <Skeleton height={14} width={colIdx === 0 ? '70%' : '55%'} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : pagination.rows.length === 0 ? (
          <EmptyState
            icon={<i className="fa-solid fa-cart-shopping text-2xl" aria-hidden="true" />}
            title={
              hasActiveFilters ? t('No online orders match the filters.') : t('No online orders yet')
            }
            description={
              hasActiveFilters
                ? undefined
                : t('Create an order from your store channel to track it here.')
            }
            action={
              !hasActiveFilters && billingAccess.operationalAllowed ? (
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => navigate('/ecommerce-orders/new')}
                  startIcon={<i className="fa-solid fa-plus text-xs" aria-hidden="true" />}
                >
                  {t('Create first order')}
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            {allowBulkActions && selectedIds.size > 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle bg-surface-card-muted/60 px-4 py-3">
                <p className="text-sm text-text-muted">
                  {isArabic
                    ? `${selectedIds.size} طلب محدد`
                    : `${selectedIds.size} selected`}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="secondary"
                    size="md"
                    disabled={exporting}
                    onClick={() => {
                      setExportError(null);
                      setExportOpen(true);
                    }}
                    startIcon={<i className="fa-solid fa-file-export text-xs" aria-hidden="true" />}
                  >
                    {t('Export')}
                  </Button>
                  <Button
                    variant="secondary"
                    size="md"
                    disabled={
                      !billingAccess.operationalAllowed ||
                      cancelBulkMut.isPending ||
                      confirmBulkMut.isPending ||
                      selectedCancellableIds.length === 0
                    }
                    title={
                      selectedCancellableIds.length === 0
                        ? t('Only orders waiting for confirmation can be confirmed.')
                        : billingAccess.operationalAllowed
                          ? undefined
                          : billingAccess.actionBlockedReason
                    }
                    loading={cancelBulkMut.isPending}
                    onClick={() => cancelBulkMut.mutate()}
                    startIcon={<i className="fa-solid fa-xmark text-xs" aria-hidden="true" />}
                  >
                    {t('Cancel')}
                  </Button>
                  <Button
                    variant="primary"
                    size="md"
                    disabled={
                      !billingAccess.operationalAllowed ||
                      confirmBulkMut.isPending ||
                      cancelBulkMut.isPending ||
                      selectedConfirmableIds.length === 0
                    }
                    title={
                      selectedConfirmableIds.length === 0
                        ? t('Only orders waiting for confirmation can be confirmed.')
                        : billingAccess.operationalAllowed
                          ? undefined
                          : billingAccess.actionBlockedReason
                    }
                    loading={confirmBulkMut.isPending}
                    onClick={() => confirmBulkMut.mutate()}
                    startIcon={<i className="fa-solid fa-check text-xs" aria-hidden="true" />}
                  >
                    {t('Confirm orders')}
                  </Button>
                </div>
              </div>
            ) : null}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-card-muted text-xs uppercase text-text-muted font-semibold">
                  <tr>
                    {allowBulkActions ? (
                      <th className="w-10 px-3 py-3 text-left">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-border-strong text-brand-600 focus:ring-brand-500 disabled:opacity-40"
                          checked={allPageSelected}
                          ref={(el) => {
                            if (el) el.indeterminate = somePageSelected;
                          }}
                          disabled={
                            pageIds.length === 0 ||
                            confirmBulkMut.isPending ||
                            cancelBulkMut.isPending
                          }
                          title={t('Select all on this page')}
                          aria-label={t('Select all on this page')}
                          onChange={(e) => toggleAllPage(e.target.checked)}
                        />
                      </th>
                    ) : null}
                    <th className="px-5 py-3 text-left">{t('Order #')}</th>
                    <th className="px-5 py-3 text-left">{t('Status')}</th>
                    <th className="px-5 py-3 text-left">{t('Recipient')}</th>
                    <th className="px-5 py-3 text-left">{t('City')}</th>
                    <th className="px-5 py-3 text-left">{t('Total')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {rows.map((row) => {
                    const checked = selectedIds.has(row.id);
                    return (
                      <tr
                        key={row.id}
                        onClick={() => navigate(`/ecommerce-orders/${row.id}`)}
                        className="hover:bg-surface-hover transition-colors cursor-pointer"
                      >
                        {allowBulkActions ? (
                          <td
                            className="w-10 px-3 py-3.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-border-strong text-brand-600 focus:ring-brand-500 disabled:opacity-40"
                              checked={checked}
                              disabled={confirmBulkMut.isPending || cancelBulkMut.isPending}
                              title={t('Select order')}
                              aria-label={`${t('Select order')} ${row.orderNumber || row.id}`}
                              onChange={(e) => toggleOne(row.id, e.target.checked)}
                            />
                          </td>
                        ) : null}
                        <td className="px-5 py-3.5 font-semibold text-text-strong font-mono">
                          <div className="flex flex-col gap-0.5">
                            <span>{row.orderNumber || '—'}</span>
                            <time className="text-xs font-normal text-text-muted" dateTime={row.createdAt}>
                              {new Date(row.createdAt).toLocaleString()}
                            </time>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <StatusBadge
                              status={clientOmsCommercialStatusBadgeKey(row.status)}
                              isArabic={isArabic}
                            >
                              {clientOmsCommercialStatusLabel(row.status, isArabic)}
                            </StatusBadge>
                            {row.needsInformation ? (
                              <StatusBadge status="failed delivery" isArabic={isArabic}>
                                {t('Incomplete Order')}
                              </StatusBadge>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-text-body">{row.recipientName || '—'}</td>
                        <td className="px-5 py-3.5 text-text-body">{row.city?.trim() || '—'}</td>
                        <td className="px-5 py-3.5 font-medium text-text-strong">
                          {row.total == null
                            ? '—'
                            : `${row.total}${row.currency ? ` ${row.currency}` : ''}`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <TableFooterPagination pagination={pagination.serverPagination} isArabic={isArabic} />
          </>
        )}
      </Card>
    </div>
  );
}
