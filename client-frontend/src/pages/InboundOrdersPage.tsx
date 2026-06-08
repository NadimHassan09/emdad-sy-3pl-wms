import { useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

import { Alert, Button } from '@ds';
import type { Column } from '@wms/components/DataTable';
import { DataTable } from '@wms/components/DataTable';
import { FILTER_PRIMARY_BUTTON_CLASS, FilterPanel } from '@wms/components/FilterPanel';
import { SelectField } from '@wms/components/SelectField';
import { StatusBadge } from '@wms/components/StatusBadge';
import { TextField } from '@wms/components/TextField';
import { useFilters } from '@wms/hooks/useFilters';
import {
  CHUNK_SIZE_STANDARD,
  useChunkedServerPagination,
} from '@wms/hooks/useChunkedServerPagination';

import { CreateClientInboundModal } from '../components/CreateClientInboundModal';
import { isClientArabic } from '../lib/client-ui-language';
import {
  createClientInboundOrder,
  fetchClientInboundOrders,
  type ClientInboundOrderRow,
} from '../services/clientInboundOrdersService';

const INBOUND_STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'pending_approval', label: 'Waiting for approval' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'partially_received', label: 'Partially received' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

type InboundListDraft = {
  orderSearch: string;
  status: string;
};

function inboundLabel(label: string, isArabic: boolean): string {
  if (!isArabic) return label;
  const ar: Record<string, string> = {
    'Inbound orders': 'طلبات الوارد',
    '+ New inbound': '+ وارد جديد',
    'Waiting for approval': 'بانتظار الموافقة',
    'Order filters': 'فلاتر الطلبات',
    'Apply filters': 'تطبيق الفلاتر',
    'Reset filters': 'إعادة تعيين الفلاتر',
    'Order #': 'رقم الطلب',
    'Search order...': 'ابحث عن الطلب...',
    Status: 'الحالة',
    'All statuses': 'كل الحالات',
    'Expected arrival': 'الوصول المتوقع',
    Lines: 'البنود',
    Created: 'تاريخ الإنشاء',
    'No inbound orders found.': 'لا توجد طلبات وارد.',
    'Could not load inbound orders': 'تعذر تحميل طلبات الوارد',
    rows: 'صف',
    results: 'نتيجة',
    of: 'من',
    Previous: 'السابق',
    Next: 'التالي',
    'Rows per page': 'عدد الصفوف لكل صفحة',
  };
  return ar[label] ?? label;
}

export function InboundOrdersPage(): ReactElement {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const isArabic = isClientArabic();
  const t = (label: string) => inboundLabel(label, isArabic);

  const createMut = useMutation({
    mutationFn: createClientInboundOrder,
    onSuccess: (order) => {
      void queryClient.invalidateQueries({ queryKey: ['client', 'inbound-orders'] });
      setCreateError(null);
      setCreateOpen(false);
      navigate(`/inbound-orders/${order.id}`);
    },
    onError: (err: Error) => {
      setCreateError(err.message || 'Could not submit order.');
    },
  });

  const initialList = useMemo<InboundListDraft>(
    () => ({ orderSearch: '', status: '' }),
    [],
  );

  const { draftFilters, appliedFilters, setDraft, applyFilters, resetFilters } =
    useFilters(initialList);

  const filterKey = useMemo(
    () => ({
      orderSearch: appliedFilters.orderSearch.trim() || undefined,
      status: appliedFilters.status.trim() || undefined,
    }),
    [appliedFilters],
  );

  const pagination = useChunkedServerPagination<ClientInboundOrderRow>({
    chunkSize: CHUNK_SIZE_STANDARD,
    filterKey,
    fetchChunk: (offset, limit) => fetchClientInboundOrders({ ...filterKey, offset, limit }),
    rtQueryKeyPrefix: ['client', 'inbound-orders'],
    chunkQueryKeyPrefix: 'client-inbound-orders-chunk',
  });

  const statusOptions = useMemo(
    () =>
      INBOUND_STATUS_OPTIONS.map((o) => ({
        ...o,
        label: o.value === '' ? t('All statuses') : o.label,
      })),
    [isArabic],
  );

  const columns: Column<ClientInboundOrderRow>[] = useMemo(
    () => [
      {
        header: t('Order #'),
        accessor: (o) => <span className="font-mono">{o.orderNumber || '—'}</span>,
        width: '170px',
      },
      {
        header: t('Status'),
        accessor: (o) => <StatusBadge status={o.status} />,
        className: 'w-1 whitespace-nowrap',
      },
      {
        header: t('Expected arrival'),
        accessor: (o) => new Date(o.expectedArrivalDate).toLocaleDateString(),
        width: '160px',
      },
      { header: t('Lines'), accessor: (o) => o._count?.lines ?? 0, width: '70px' },
      {
        header: t('Created'),
        accessor: (o) => new Date(o.createdAt).toLocaleString(),
      },
    ],
    [isArabic],
  );

  return (
    <>
      {pagination.isError && (
        <Alert
          variant="error"
          title={t('Could not load inbound orders')}
          description="Check your connection and try refreshing the page."
          action={
            <Alert.Action variant="error" onClick={() => pagination.refetch()}>
              Retry
            </Alert.Action>
          }
          className="mb-3"
        />
      )}

      <FilterPanel
        title={t('Order filters')}
        onApply={applyFilters}
        onReset={resetFilters}
        loading={pagination.isFetching}
        applyLabel={t('Apply filters')}
        resetLabel={t('Reset filters')}
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          <TextField
            label={t('Order #')}
            value={draftFilters.orderSearch}
            onChange={(e) => setDraft({ orderSearch: e.target.value })}
            placeholder={t('Search order...')}
            className="font-mono text-xs"
          />
          <SelectField
            label={t('Status')}
            value={draftFilters.status}
            onChange={(e) => setDraft({ status: e.target.value })}
            options={statusOptions}
          />
        </div>
      </FilterPanel>

      <DataTable
        title={t('Inbound orders')}
        titleAs="h1"
        actions={
          <Button
            variant="primary"
            size="md"
            onClick={() => {
              setCreateError(null);
              setCreateOpen(true);
            }}
            className={FILTER_PRIMARY_BUTTON_CLASS}
          >
            {t('+ New inbound')}
          </Button>
        }
        columns={columns}
        rows={pagination.rows}
        rowKey={(o) => o.id}
        loading={pagination.isInitialLoading}
        onRowClick={(o) => navigate(`/inbound-orders/${o.id}`)}
        empty={t('No inbound orders found.')}
        serverPagination={pagination.serverPagination}
        labels={{
          rowsSuffix: t('rows'),
          resultsSuffix: t('results'),
          ofWord: t('of'),
          previous: t('Previous'),
          next: t('Next'),
          rowsPerPageAria: t('Rows per page'),
        }}
      />

      <CreateClientInboundModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        loading={createMut.isPending}
        submitError={createError}
        onSubmit={(input) => {
          setCreateError(null);
          createMut.mutate(input);
        }}
        isArabic={isArabic}
      />
    </>
  );
}
