import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  Alert,
  AdvancedFilterSection,
  countNonEmptyFilters,
  FILTER_COMPACT_SEARCH_CLASS,
  FILTER_COMPACT_SELECT_CLASS,
  FILTER_FIELD_CONTROL_CLASS,
} from '@ds';
import {
  CHUNK_SIZE_STANDARD,
  useChunkedServerPagination,
} from '../hooks/useChunkedServerPagination';
import { useCachedState } from '../hooks/useCachedState';
import { useFilters } from '../hooks/useFilters';

import { Badge } from '../design-v2/Badge';
import { Card } from '../design-v2/Card';
import { ListPageHeader } from '../design-v2/ListPageHeader';
import { TableFooterPagination } from '../design-v2/TableFooterPagination';
import { ClientOrderImportModal } from '../components/ClientOrderImportModal';
import { ClientOmsOrdersExportModal } from '../components/ClientOmsOrdersExportModal';
import { useClientOperationalAccess } from '../hooks/useClientOperationalAccess';
import {
  clientInboundStatusLabel,
  mapClientInboundDisplayStatus,
} from '../lib/client-inbound-status';
import { isClientArabic } from '../lib/client-ui-language';
import { isProductionClientPortal } from '../lib/production-client-portal';
import { fetchClientInboundOrders } from '../services/clientInboundOrdersService';
import {
  CLIENT_INBOUND_EXPORT_COLUMNS,
  downloadClientOrdersExport,
} from '../services/clientOrdersExport';

const INBOUND_STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'pending_approval', label: 'Waiting for approval' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

function inboundLabel(label: string, isArabic: boolean): string {
  if (!isArabic) return label;
  const ar: Record<string, string> = {
    'Inbound Orders': 'طلبات الوارد',
    'Manage and track your inbound orders': 'إدارة وتتبع طلبات الوارد الخاصة بك',
    'Warehouse receipts': 'إيصالات المستودع',
    'New inbound': 'وارد جديد',
    Import: 'استيراد',
    Export: 'تصدير',
    'Select all on this page': 'تحديد الكل في هذه الصفحة',
    'Select order': 'اختر الطلب',
    'Search order number...': 'ابحث برقم الطلب...',
    Filters: 'فلاتر',
    'All statuses': 'كل الحالات',
    'Waiting for approval': 'بانتظار الموافقة',
    'In progress': 'قيد التنفيذ',
    Completed: 'مكتمل',
    Cancelled: 'ملغي',
    'Order #': 'رقم الطلب',
    Status: 'الحالة',
    'Expected Arrival': 'الوصول المتوقع',
    Lines: 'البنود',
    Created: 'تاريخ الإنشاء',
    Actions: 'الإجراءات',
    'No inbound orders found.': 'لا توجد طلبات وارد.',
    'Could not load inbound orders': 'تعذر تحميل طلبات الوارد',
    Retry: 'إعادة المحاولة',
  };
  return ar[label] ?? label;
}

const INBOUND_LIST_FILTERS = { search: '', status: '' };

export function InboundOrdersPage(): ReactElement {
  const navigate = useNavigate();
  const { draftFilters, appliedFilters, setDraft, applyFilters, resetFilters } =
    useFilters(INBOUND_LIST_FILTERS);
  const [advancedOpen, setAdvancedOpen] = useCachedState('advanced-filters-open', false);
  const isArabic = isClientArabic();
  const t = (label: string) => inboundLabel(label, isArabic);
  const billingAccess = useClientOperationalAccess(isArabic);
  const [importOpen, setImportOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const hideImportUi = isProductionClientPortal();
  const allowExportUi = !isProductionClientPortal();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  const filterKey = useMemo(
    () => ({
      orderSearch: appliedFilters.search.trim() || undefined,
      status: appliedFilters.status || undefined,
    }),
    [appliedFilters],
  );

  const pagination = useChunkedServerPagination({
    chunkSize: CHUNK_SIZE_STANDARD,
    filterKey,
    fetchChunk: (offset, limit) =>
      fetchClientInboundOrders({ ...filterKey, offset, limit }),
    rtQueryKeyPrefix: ['client', 'inbound-orders'],
    chunkQueryKeyPrefix: 'client-inbound-orders-chunk',
  });

  const rows = pagination.rows as Array<{ id: string }>;
  const pageIds = useMemo(() => rows.map((r) => r.id), [rows]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [filterKey.orderSearch, filterKey.status, pagination.page]);

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

  const onExportSubmit = async (payload: { columnIds: string[]; arabicHeaders: boolean }) => {
    if (exporting) return;
    setExporting(true);
    setExportError(null);
    try {
      const ids = selectedIds.size > 0 ? Array.from(selectedIds) : undefined;
      await downloadClientOrdersExport('inbound', {
        ...payload,
        ids,
        orderSearch: ids ? undefined : filterKey.orderSearch,
        status: ids ? undefined : filterKey.status,
      });
      setExportOpen(false);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Export failed.');
    } finally {
      setExporting(false);
    }
  };


  return (
    <div className="space-y-5 animate-enter">
      <ListPageHeader
        icon="fa-arrow-down"
        title={t('Inbound Orders')}
        subtitle={t('Warehouse receipts')}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            
            {allowExportUi ? (
              <button
                type="button"
                disabled={exporting}
                onClick={() => {
                  setExportError(null);
                  setExportOpen(true);
                }}
                className="px-4 py-2 bg-white text-text-strong border border-border-strong rounded-lg text-sm font-medium hover:bg-surface-hover transition-all flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <i className="fa-solid fa-file-export text-xs" /> {t('Export')}
              </button>
            ) : null}

            {!hideImportUi ? (
              <button
                type="button"
                disabled={!billingAccess.operationalAllowed}
                title={billingAccess.operationalAllowed ? undefined : billingAccess.actionBlockedReason}
                onClick={() => setImportOpen(true)}
                className="px-4 py-2 bg-white text-text-strong border border-border-strong rounded-lg text-sm font-medium hover:bg-surface-hover transition-all flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <i className="fa-solid fa-file-import text-xs" /> {t('Import')}
              </button>
            ) : null}
            <button
              type="button"
              disabled={!billingAccess.operationalAllowed}
              title={billingAccess.operationalAllowed ? undefined : billingAccess.actionBlockedReason}
              onClick={() => navigate('/inbound-orders/new')}
              className="px-4 py-2 bg-cta text-white rounded-lg text-sm font-medium hover:bg-cta-hover transition-all shadow-lg shadow-brand-600/20 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <i className="fa-solid fa-plus text-xs" /> {t('New inbound')}
            </button>
          </div>
        }
      />

      {!hideImportUi ? (
        <ClientOrderImportModal
          kind="inbound"
          open={importOpen}
          onClose={() => setImportOpen(false)}
          onImported={() => pagination.refetch()}
          disabled={!billingAccess.operationalAllowed}
          disabledReason={billingAccess.actionBlockedReason}
        />
      ) : null}

      {allowExportUi ? (
        <ClientOmsOrdersExportModal
          open={exportOpen}
          onClose={() => {
            if (!exporting) setExportOpen(false);
          }}
          columns={CLIENT_INBOUND_EXPORT_COLUMNS}
          exporting={exporting}
          onExport={(payload) => void onExportSubmit(payload)}
          isArabic={isArabic}
          errorMessage={exportError}
          title={isArabic ? 'تصدير طلبات الوارد' : 'Export inbound orders'}
        />
      ) : null}

      {pagination.isError ? (
        <Alert variant="error" title={t('Could not load inbound orders')}>
          <Alert.Action variant="error" onClick={() => pagination.refetch()}>
            {t('Retry')}
          </Alert.Action>
        </Alert>
      ) : null}

      <AdvancedFilterSection
        advancedOpen={advancedOpen}
        onAdvancedOpenChange={setAdvancedOpen}
        isArabic={isArabic}
        loading={pagination.isFetching}
        activeCount={countNonEmptyFilters(appliedFilters, ['status'])}
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
            <select
              value={draftFilters.status}
              onChange={(e) => setDraft({ status: e.target.value })}
              aria-label={t('All statuses')}
              className={FILTER_COMPACT_SELECT_CLASS}
            >
              {INBOUND_STATUS_OPTIONS.map((o) => (
                <option key={o.value || 'all'} value={o.value}>
                  {o.value === '' ? t('All statuses') : t(o.label)}
                </option>
              ))}
            </select>
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
          <label className="mb-1 block text-xs font-semibold text-text-muted">{t('Status')}</label>
          <select
            value={draftFilters.status}
            onChange={(e) => setDraft({ status: e.target.value })}
            className={FILTER_FIELD_CONTROL_CLASS}
          >
            {INBOUND_STATUS_OPTIONS.map((o) => (
              <option key={o.value || 'all'} value={o.value}>
                {o.value === '' ? t('All statuses') : t(o.label)}
              </option>
            ))}
          </select>
        </div>
      </AdvancedFilterSection>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            {allowExportUi && selectedIds.size > 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle bg-surface-card-muted/60 px-4 py-3">
                <p className="text-sm text-text-muted">
                  {isArabic ? `${selectedIds.size} طلب محدد` : `${selectedIds.size} selected`}
                </p>
                <button
                  type="button"
                  disabled={exporting}
                  onClick={() => {
                    setExportError(null);
                    setExportOpen(true);
                  }}
                  className="px-3 py-1.5 bg-white text-text-strong border border-border-strong rounded-lg text-sm font-medium hover:bg-surface-hover"
                >
                  {t('Export')}
                </button>
              </div>
            ) : null}
            <thead className="bg-surface-card-muted text-xs uppercase text-text-muted font-semibold">
              <tr>
                {allowExportUi ? (
                  <th className="w-10 px-3 py-3 text-left">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-border-strong text-brand-600 focus:ring-brand-500"
                      checked={allPageSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = somePageSelected;
                      }}
                      disabled={pageIds.length === 0}
                      title={t('Select all on this page')}
                      aria-label={t('Select all on this page')}
                      onChange={(e) => toggleAllPage(e.target.checked)}
                    />
                  </th>
                ) : null}
                <th className="px-5 py-3 text-left">{t('Order #')}</th>
                <th className="px-5 py-3 text-left">{t('Status')}</th>
                <th className="px-5 py-3 text-left">{t('Expected Arrival')}</th>
                <th className="px-5 py-3 text-left">{t('Lines')}</th>
                <th className="px-5 py-3 text-right">{t('Created')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {pagination.isInitialLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={`sk-${i}`} className="animate-pulse">
                    <td className="px-5 py-3.5" colSpan={allowExportUi ? 6 : 5}>
                      <div className="h-4 w-full max-w-xl rounded bg-skeleton-base" />
                    </td>
                  </tr>
                ))
              ) : pagination.rows.length === 0 ? (
                <tr>
                  <td colSpan={allowExportUi ? 6 : 5} className="px-5 py-10 text-center text-text-faint text-sm">
                    {t('No inbound orders found.')}
                  </td>
                </tr>
              ) : (
                pagination.rows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => navigate(`/inbound-orders/${row.id}`)}
                    className="hover:bg-surface-hover transition-colors group cursor-pointer"
                  >
                    {allowExportUi ? (
                      <td className="w-10 px-3 py-3.5" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-border-strong text-brand-600 focus:ring-brand-500"
                          checked={selectedIds.has(row.id)}
                          title={t('Select order')}
                          aria-label={`${t('Select order')} ${row.orderNumber || row.id}`}
                          onChange={(e) => toggleOne(row.id, e.target.checked)}
                        />
                      </td>
                    ) : null}
                    <td className="px-5 py-3.5 font-semibold text-text-strong font-mono">
                      {row.orderNumber || '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge status={mapClientInboundDisplayStatus(row.status)}>
                        {clientInboundStatusLabel(row.status, isArabic)}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5 text-text-body">
                      {new Date(row.expectedArrivalDate).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3.5 text-text-body">{row._count?.lines ?? 0}</td>
                    <td className="px-5 py-3.5 text-right text-text-muted text-xs">
                      {new Date(row.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <TableFooterPagination pagination={pagination.serverPagination} isArabic={isArabic} />
      </Card>
    </div>
  );
}
