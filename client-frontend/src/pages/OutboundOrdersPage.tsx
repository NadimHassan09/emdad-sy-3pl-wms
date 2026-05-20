import { useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

import { Alert, Button } from '@ds';
import type { Column } from '@wms/components/DataTable';
import { DataTable } from '@wms/components/DataTable';
import { FILTER_PRIMARY_BUTTON_CLASS, FilterPanel } from '@wms/components/FilterPanel';
import { SelectField } from '@wms/components/SelectField';
import { StatusBadge } from '@wms/components/StatusBadge';
import { TextField } from '@wms/components/TextField';
import { useFilters } from '@wms/hooks/useFilters';

import { CreateClientOutboundModal } from '../components/CreateClientOutboundModal';
import { isClientArabic } from '../lib/client-ui-language';
import {
  createClientOutboundOrder,
  fetchClientOutboundOrders,
  type ClientOutboundOrderRow,
} from '../services/clientOutboundOrdersService';

const LIST_LIMIT = 200;

const OUTBOUND_STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'pending_approval', label: 'Waiting for approval' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'picking', label: 'Picking' },
  { value: 'packing', label: 'Packing' },
  { value: 'ready_to_ship', label: 'Ready to ship' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'cancelled', label: 'Cancelled' },
];

type OutboundListDraft = {
  orderSearch: string;
  status: string;
};

function outboundLabel(label: string, isArabic: boolean): string {
  if (!isArabic) return label;
  const ar: Record<string, string> = {
    'Outbound orders': 'طلبات الصادر',
    '+ New outbound': '+ صادر جديد',
    'Waiting for approval': 'بانتظار الموافقة',
    'Order filters': 'فلاتر الطلبات',
    'Apply filters': 'تطبيق الفلاتر',
    'Reset filters': 'إعادة تعيين الفلاتر',
    'Order #': 'رقم الطلب',
    'Search order...': 'ابحث عن الطلب...',
    Status: 'الحالة',
    'All statuses': 'كل الحالات',
    'Required ship': 'الشحن المطلوب',
    Lines: 'البنود',
    Created: 'تاريخ الإنشاء',
    'No outbound orders found.': 'لا توجد طلبات صادر.',
    'Could not load outbound orders': 'تعذر تحميل طلبات الصادر',
    rows: 'صف',
    results: 'نتيجة',
    of: 'من',
    Previous: 'السابق',
    Next: 'التالي',
    'Rows per page': 'عدد الصفوف لكل صفحة',
  };
  return ar[label] ?? label;
}

export function OutboundOrdersPage(): ReactElement {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const isArabic = isClientArabic();
  const t = (label: string) => outboundLabel(label, isArabic);

  const createMut = useMutation({
    mutationFn: createClientOutboundOrder,
    onSuccess: (order) => {
      void queryClient.invalidateQueries({ queryKey: ['client', 'outbound-orders'] });
      setCreateError(null);
      setCreateOpen(false);
      navigate(`/outbound-orders/${order.id}`);
    },
    onError: (err: Error) => {
      setCreateError(err.message || 'Could not submit order.');
    },
  });

  const initialList = useMemo<OutboundListDraft>(
    () => ({ orderSearch: '', status: '' }),
    [],
  );

  const { draftFilters, appliedFilters, setDraft, applyFilters, resetFilters } =
    useFilters(initialList);

  const listParams = useMemo(
    () => ({
      limit: LIST_LIMIT,
      offset: 0,
      orderSearch: appliedFilters.orderSearch.trim() || undefined,
      status: appliedFilters.status.trim() || undefined,
    }),
    [appliedFilters],
  );

  const list = useQuery({
    queryKey: ['client', 'outbound-orders', listParams],
    queryFn: () => fetchClientOutboundOrders(listParams),
  });

  const statusOptions = useMemo(
    () =>
      OUTBOUND_STATUS_OPTIONS.map((o) => ({
        ...o,
        label: o.value === '' ? t('All statuses') : o.label,
      })),
    [isArabic],
  );

  const columns: Column<ClientOutboundOrderRow>[] = useMemo(
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
        header: t('Required ship'),
        accessor: (o) => new Date(o.requiredShipDate).toLocaleDateString(),
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
      {list.isError && (
        <Alert
          variant="error"
          title={t('Could not load outbound orders')}
          description="Check your connection and try refreshing the page."
          action={
            <Alert.Action variant="error" onClick={() => list.refetch()}>
              Retry
            </Alert.Action>
          }
          className="mb-4"
        />
      )}

      <FilterPanel
        title={t('Order filters')}
        onApply={applyFilters}
        onReset={resetFilters}
        loading={list.isFetching}
        applyLabel={t('Apply filters')}
        resetLabel={t('Reset filters')}
      >
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
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
        title={t('Outbound orders')}
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
            {t('+ New outbound')}
          </Button>
        }
        columns={columns}
        rows={list.data?.items ?? []}
        rowKey={(o) => o.id}
        loading={list.isLoading}
        onRowClick={(o) => navigate(`/outbound-orders/${o.id}`)}
        empty={t('No outbound orders found.')}
        labels={{
          rowsSuffix: t('rows'),
          resultsSuffix: t('results'),
          ofWord: t('of'),
          previous: t('Previous'),
          next: t('Next'),
          rowsPerPageAria: t('Rows per page'),
        }}
      />

      <CreateClientOutboundModal
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
