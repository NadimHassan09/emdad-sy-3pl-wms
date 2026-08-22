import { useMemo, useState, type ReactElement } from 'react';
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
import { useClientOperationalAccess } from '../hooks/useClientOperationalAccess';
import { mapClientOutboundDisplayStatus, clientOutboundStatusLabel } from '../lib/client-outbound-status';
import { isClientArabic } from '../lib/client-ui-language';
import { fetchClientOutboundOrders } from '../services/clientOutboundOrdersService';

const OUTBOUND_STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'pending_approval', label: 'Waiting for approval' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'cancelled', label: 'Cancelled' },
];

function outboundLabel(label: string, isArabic: boolean): string {
  if (!isArabic) return label;
  const ar: Record<string, string> = {
    'Outbound Orders': 'طلبات الصادر',
    'Manage and track your outbound orders': 'إدارة وتتبع طلبات الصادر الخاصة بك',
    'Warehouse shipments': 'شحنات المستودع',
    'New outbound': 'صادر جديد',
    Import: 'استيراد',
    'Search order number...': 'ابحث برقم الطلب...',
    Filters: 'فلاتر',
    'All statuses': 'كل الحالات',
    'Waiting for approval': 'بانتظار الموافقة',
    'In progress': 'قيد التنفيذ',
    Shipped: 'تم الشحن',
    Cancelled: 'ملغي',
    'Order #': 'رقم الطلب',
    Status: 'الحالة',
    Recipient: 'المستلم',
    'Required Ship': 'الشحن المطلوب',
    Lines: 'البنود',
    Created: 'تاريخ الإنشاء',
    Actions: 'الإجراءات',
    'No outbound orders found.': 'لا توجد طلبات صادر.',
    'Could not load outbound orders': 'تعذر تحميل طلبات الصادر',
    Retry: 'إعادة المحاولة',
  };
  return ar[label] ?? label;
}

const OUTBOUND_LIST_FILTERS = { search: '', status: '' };

export function OutboundOrdersPage(): ReactElement {
  const navigate = useNavigate();
  const { draftFilters, appliedFilters, setDraft, applyFilters, resetFilters } =
    useFilters(OUTBOUND_LIST_FILTERS);
  const [advancedOpen, setAdvancedOpen] = useCachedState('advanced-filters-open', false);
  const isArabic = isClientArabic();
  const t = (label: string) => outboundLabel(label, isArabic);
  const billingAccess = useClientOperationalAccess(isArabic);
  const [importOpen, setImportOpen] = useState(false);

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
      fetchClientOutboundOrders({ ...filterKey, offset, limit }),
    rtQueryKeyPrefix: ['client', 'outbound-orders'],
    chunkQueryKeyPrefix: 'client-outbound-orders-chunk',
  });

  return (
    <div className="space-y-5 animate-enter">
      <ListPageHeader
        icon="fa-arrow-up"
        title={t('Outbound Orders')}
        subtitle={t('Warehouse shipments')}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={!billingAccess.operationalAllowed}
              title={billingAccess.operationalAllowed ? undefined : billingAccess.actionBlockedReason}
              onClick={() => setImportOpen(true)}
              className="px-4 py-2 bg-white text-text-strong border border-border-strong rounded-lg text-sm font-medium hover:bg-surface-hover transition-all flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <i className="fa-solid fa-file-import text-xs" /> {t('Import')}
            </button>
            <button
              type="button"
              disabled={!billingAccess.operationalAllowed}
              title={billingAccess.operationalAllowed ? undefined : billingAccess.actionBlockedReason}
              onClick={() => navigate('/outbound-orders/new')}
              className="px-4 py-2 bg-cta text-white rounded-lg text-sm font-medium hover:bg-cta-hover transition-all shadow-lg shadow-brand-600/20 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <i className="fa-solid fa-plus text-xs" /> {t('New outbound')}
            </button>
          </div>
        }
      />

      <ClientOrderImportModal
        kind="outbound"
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => pagination.refetch()}
        disabled={!billingAccess.operationalAllowed}
        disabledReason={billingAccess.actionBlockedReason}
      />

      {pagination.isError ? (
        <Alert variant="error" title={t('Could not load outbound orders')}>
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
              {OUTBOUND_STATUS_OPTIONS.map((o) => (
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
            {OUTBOUND_STATUS_OPTIONS.map((o) => (
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
            <thead className="bg-surface-card-muted text-xs uppercase text-text-muted font-semibold">
              <tr>
                <th className="px-5 py-3 text-left">{t('Order #')}</th>
                <th className="px-5 py-3 text-left">{t('Status')}</th>
                <th className="px-5 py-3 text-left">{t('Recipient')}</th>
                <th className="px-5 py-3 text-left">{t('Required Ship')}</th>
                <th className="px-5 py-3 text-left">{t('Lines')}</th>
                <th className="px-5 py-3 text-right">{t('Created')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {pagination.isInitialLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={`sk-${i}`} className="animate-pulse">
                    <td className="px-5 py-3.5" colSpan={6}>
                      <div className="h-4 w-full max-w-xl rounded bg-skeleton-base" />
                    </td>
                  </tr>
                ))
              ) : pagination.rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-text-faint text-sm">
                    {t('No outbound orders found.')}
                  </td>
                </tr>
              ) : (
                pagination.rows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => navigate(`/outbound-orders/${row.id}`)}
                    className="hover:bg-surface-hover transition-colors group cursor-pointer"
                  >
                    <td className="px-5 py-3.5 font-semibold text-text-strong font-mono">
                      {row.orderNumber || '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge status={mapClientOutboundDisplayStatus(row.status)}>
                        {clientOutboundStatusLabel(row.status, isArabic)}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5 text-text-body">{row.recipientName || '—'}</td>
                    <td className="px-5 py-3.5 text-text-body">
                      {row.requiredShipDate
                        ? new Date(row.requiredShipDate).toLocaleDateString()
                        : '—'}
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
