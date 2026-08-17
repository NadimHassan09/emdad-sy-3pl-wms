import { useMemo, type ReactElement } from 'react';
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
  FILTER_COMPACT_SELECT_CLASS,
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
import { useClientOperationalAccess } from '../hooks/useClientOperationalAccess';
import {
  CLIENT_OMS_COMMERCIAL_FILTER_OPTIONS,
  clientOmsCommercialStatusBadgeKey,
  clientOmsCommercialStatusLabel,
} from '../lib/client-oms-commercial-status';
import { isClientArabic } from '../lib/client-ui-language';
import {
  fetchClientOmsOrders,
  type ClientOmsOrderListItem,
  type ClientOmsOrderStatus,
} from '../services/clientOmsOrdersService';

const STATUS_OPTIONS = CLIENT_OMS_COMMERCIAL_FILTER_OPTIONS.map((o) => ({
  value: o.value,
  label: o.label,
}));

function labelText(label: string, isArabic: boolean): string {
  if (!isArabic) return label;
  const ar: Record<string, string> = {
    'Online orders': 'الطلبات الإلكترونية',
    'Orders from your store channels': 'طلبات من قنوات متجرك',
    'Create order': 'إنشاء طلب',
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
  };
  return ar[label] ?? label;
}

const ECOMMERCE_LIST_FILTERS = { search: '', status: '' };

export function EcommerceOrdersPage(): ReactElement {
  const navigate = useNavigate();
  const { draftFilters, appliedFilters, setDraft, applyFilters, resetFilters } =
    useFilters(ECOMMERCE_LIST_FILTERS);
  const [advancedOpen, setAdvancedOpen] = useCachedState('advanced-filters-open', false);
  const isArabic = isClientArabic();
  const t = (label: string) => labelText(label, isArabic);
  const billingAccess = useClientOperationalAccess(isArabic);

  const filterKey = useMemo(
    () => ({
      orderSearch: appliedFilters.search.trim() || undefined,
      status: (appliedFilters.status || undefined) as ClientOmsOrderStatus | undefined,
    }),
    [appliedFilters],
  );

  const pagination = useChunkedServerPagination<ClientOmsOrderListItem>({
    chunkSize: CHUNK_SIZE_STANDARD,
    filterKey,
    fetchChunk: (offset, limit) => fetchClientOmsOrders({ ...filterKey, offset, limit }),
    rtQueryKeyPrefix: ['client', 'ecommerce-orders'],
    chunkQueryKeyPrefix: 'client-ecommerce-orders-chunk',
  });

  const hasActiveFilters = Boolean(appliedFilters.search.trim() || appliedFilters.status);

  const createButton = (
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
  );

  return (
    <div className="space-y-5 animate-enter">
      <ListPageHeader
        icon="fa-cart-shopping"
        title={t('Online orders')}
        subtitle={t('Orders from your store channels')}
        actions={createButton}
      />

      <StorePillTabs isArabic={isArabic} />

      {pagination.isError ? (
        <Alert variant="error" title={t('Could not load online orders')}>
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
              className={FILTER_COMPACT_SELECT_CLASS}
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value || 'all'} value={o.value}>
                  {o.value === '' ? t('All statuses') : o.label}
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
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value || 'all'} value={o.value}>
                {o.value === '' ? t('All statuses') : o.label}
              </option>
            ))}
          </select>
        </div>
      </AdvancedFilterSection>

      <Card className="overflow-hidden">
        {pagination.isInitialLoading ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-card-muted text-xs uppercase text-text-muted font-semibold">
                <tr>
                  <th className="px-5 py-3 text-left">{t('Order #')}</th>
                  <th className="px-5 py-3 text-left">{t('Status')}</th>
                  <th className="px-5 py-3 text-left">{t('Recipient')}</th>
                  <th className="px-5 py-3 text-left">{t('Channel')}</th>
                  <th className="px-5 py-3 text-left">{t('Total')}</th>
                  <th className="px-5 py-3 text-right">{t('Created')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {Array.from({ length: 6 }).map((_, rowIdx) => (
                  <tr key={`sk-${rowIdx}`}>
                    {Array.from({ length: 6 }).map((__, colIdx) => (
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
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-card-muted text-xs uppercase text-text-muted font-semibold">
                  <tr>
                    <th className="px-5 py-3 text-left">{t('Order #')}</th>
                    <th className="px-5 py-3 text-left">{t('Status')}</th>
                    <th className="px-5 py-3 text-left">{t('Recipient')}</th>
                    <th className="px-5 py-3 text-left">{t('City')}</th>
                    <th className="px-5 py-3 text-left">{t('Channel')}</th>
                    <th className="px-5 py-3 text-left">{t('Total')}</th>
                    <th className="px-5 py-3 text-right">{t('Created')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {(pagination.rows as ClientOmsOrderListItem[]).map((row) => (
                    <tr
                      key={row.id}
                      onClick={() => navigate(`/ecommerce-orders/${row.id}`)}
                      className="hover:bg-surface-hover transition-colors cursor-pointer"
                    >
                      <td className="px-5 py-3.5 font-semibold text-text-strong font-mono">
                        {row.orderNumber || '—'}
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusBadge status={clientOmsCommercialStatusBadgeKey(row.status)} isArabic={isArabic}>
                          {clientOmsCommercialStatusLabel(row.status, isArabic)}
                        </StatusBadge>
                      </td>
                      <td className="px-5 py-3.5 text-text-body">{row.recipientName || '—'}</td>
                      <td className="px-5 py-3.5 text-text-body">{row.city?.trim() || '—'}</td>
                      <td className="px-5 py-3.5 text-text-body">{row.storeChannel || '—'}</td>
                      <td className="px-5 py-3.5 font-medium text-text-strong">
                        {row.total == null
                          ? '—'
                          : `${row.total}${row.currency ? ` ${row.currency}` : ''}`}
                      </td>
                      <td className="px-5 py-3.5 text-right text-text-muted text-xs">
                        {new Date(row.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
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
