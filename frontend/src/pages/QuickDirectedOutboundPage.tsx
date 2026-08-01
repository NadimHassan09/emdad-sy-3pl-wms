import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { CompaniesApi } from '../api/companies';
import {
  OutboundApi,
  OutboundOrder,
  OutboundOrderStatus,
  type QuickDirectedOutboundResult,
} from '../api/outbound';
import { CreateQuickDirectedOutboundModal } from '../components/outbound/CreateQuickDirectedOutboundModal';
import { Alert, Button as DsButton } from '@ds';
import { AdminListPageShell } from '../components/AdminListPageShell';
import { Button } from '../components/Button';
import { Column, DataTable } from '../components/DataTable';
import { FILTER_PRIMARY_BUTTON_CLASS, FilterPanel } from '../components/FilterPanel';
import { Combobox } from '../components/Combobox';
import { Modal } from '../components/Modal';
import { SelectField } from '../components/SelectField';
import { StatusBadge } from '../components/StatusBadge';
import { TextField } from '../components/TextField';
import { useToast } from '../components/ToastProvider';
import { QK } from '../constants/query-keys';
import { useDefaultWarehouseId } from '../hooks/useDefaultWarehouse';
import { useFilters } from '../hooks/useFilters';
import {
  CHUNK_SIZE_STANDARD,
  useChunkedServerPagination,
} from '../hooks/useChunkedServerPagination';
import { companyFilterComboboxOptions } from '../lib/company-filter-options';
import { invalidateWorkflowTasksInventory } from '../lib/invalidate-wms-queries';
import {
  quickDirectedReasonFromReference,
  quickDirectedReasonLabel,
} from '../lib/quick-directed-outbound';
import { useWmsTranslation } from '../lib/ui-i18n';

type QuickOutListDraft = {
  orderSearch: string;
  companyId: string;
  status: string;
  createdFrom: string;
  createdTo: string;
};

function fmtQty(value: string | undefined): string {
  if (!value) return '—';
  const n = Number(value);
  if (Number.isNaN(n)) return value;
  return Number.isInteger(n) ? String(n) : n.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

export function QuickDirectedOutboundPage() {
  const { t, isArabic } = useWmsTranslation();
  const toast = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { warehouseId } = useDefaultWarehouseId();

  const [createOpen, setCreateOpen] = useState(false);
  const [successResult, setSuccessResult] = useState<QuickDirectedOutboundResult | null>(null);

  const initialList = useMemo<QuickOutListDraft>(
    () => ({
      orderSearch: '',
      companyId: '',
      status: '',
      createdFrom: '',
      createdTo: '',
    }),
    [],
  );

  const { draftFilters, appliedFilters, setDraft, applyFilters, resetFilters } =
    useFilters(initialList);

  const listParams = useMemo(
    () => ({
      warehouseId: warehouseId || undefined,
      companyId: appliedFilters.companyId || undefined,
      status: (appliedFilters.status.trim() || undefined) as OutboundOrderStatus | undefined,
      orderSearch: appliedFilters.orderSearch.trim() || undefined,
      createdFrom: appliedFilters.createdFrom.trim() || undefined,
      createdTo: appliedFilters.createdTo.trim() || undefined,
      quickDirectedOnly: true as const,
    }),
    [appliedFilters, warehouseId],
  );

  const pagination = useChunkedServerPagination<OutboundOrder>({
    chunkSize: CHUNK_SIZE_STANDARD,
    filterKey: listParams,
    fetchChunk: (offset, limit) => OutboundApi.list({ ...listParams, offset, limit }),
    rtQueryKeyPrefix: QK.outboundOrders,
    chunkQueryKeyPrefix: 'quick-directed-outbound-chunk',
    enabled: !!warehouseId,
  });

  const companies = useQuery({
    queryKey: QK.companies,
    queryFn: () => CompaniesApi.list(),
    staleTime: 10 * 60_000,
  });

  const clientFilterOptions = useMemo(
    () => companyFilterComboboxOptions(companies.data, t(['All clients', 'كل العملاء'])),
    [companies.data, isArabic],
  );

  const statusFilterOptions = useMemo(
    () => [
      { value: '', label: t(['All statuses', 'كل الحالات']) },
      { value: 'shipped', label: t(['Shipped', 'تم الشحن']) },
      { value: 'cancelled', label: t(['Cancelled', 'ملغي']) },
    ],
    [isArabic],
  );

  const createMut = useMutation({
    mutationFn: (input: {
      productCode: string;
      quantity: number;
      reasonCode: QuickDirectedOutboundResult['reasonCode'];
    }) => {
      if (!warehouseId) throw new Error('Warehouse is required.');
      return OutboundApi.quickDirected({ warehouseId, ...input });
    },
    onSuccess: (result) => {
      invalidateWorkflowTasksInventory(qc, {
        referenceId: result.orderId,
        referenceType: 'outbound_order',
      });
      qc.invalidateQueries({ queryKey: QK.outboundOrders });
      pagination.refetch();
      setCreateOpen(false);
      setSuccessResult(result);
    },
    onError: (error: Error) => {
      toast.error(error.message || t(['Outbound failed.', 'فشل الإخراج.']));
    },
  });

  const columns: Column<OutboundOrder>[] = useMemo(
    () => [
      {
        header: t(['Order #', 'رقم الطلب']),
        accessor: (order) => <span className="font-mono">{order.orderNumber || '—'}</span>,
        width: '170px',
      },
      {
        header: t(['Client', 'العميل']),
        accessor: (order) => order.company?.name ?? '—',
        width: '180px',
      },
      {
        header: t(['Product', 'المنتج']),
        accessor: (order) => {
          const line = order.lines?.[0];
          if (!line?.product) return '—';
          return (
            <div>
              <div className="font-medium text-text-strong">{line.product.name}</div>
              <div className="font-mono text-xs text-text-muted">{line.product.sku}</div>
            </div>
          );
        },
      },
      {
        header: t(['Qty', 'الكمية']),
        accessor: (order) => (
          <span className="font-mono text-text-strong">
            {fmtQty(order.lines?.[0]?.requestedQuantity)}
          </span>
        ),
        width: '90px',
        className: 'text-right',
      },
      {
        header: t(['Reason', 'السبب']),
        accessor: (order) =>
          quickDirectedReasonLabel(
            quickDirectedReasonFromReference(order.clientReference),
            isArabic,
          ),
        width: '120px',
      },
      {
        header: t(['Status', 'الحالة']),
        accessor: (order) => <StatusBadge status={order.status} />,
        className: 'w-1 whitespace-nowrap',
      },
      {
        header: t(['Created', 'تاريخ الإنشاء']),
        accessor: (order) => new Date(order.createdAt).toLocaleString(),
        width: '170px',
      },
    ],
    [isArabic],
  );

  return (
    <AdminListPageShell
      icon="fa-bolt"
      title={t(['Quick directed outbound', 'إخراج مخزني سريع موجّه'])}
      isArabic={isArabic}
      actions={
        <DsButton
          variant="primary"
          size="md"
          onClick={() => setCreateOpen(true)}
          className={FILTER_PRIMARY_BUTTON_CLASS}
          disabled={!warehouseId}
        >
          {t(['+ New quick outbound', '+ إخراج سريع جديد'])}
        </DsButton>
      }
    >
      {!warehouseId && (
        <Alert
          variant="warning"
          title={t(['Warehouse not configured', 'المستودع غير مُعد'])}
          description={t([
            'No default warehouse is set. Contact your administrator before creating quick outbound orders.',
            'لم يتم تعيين مستودع افتراضي. تواصل مع المسؤول قبل إنشاء إخراج سريع.',
          ])}
          className="mb-4"
        />
      )}

      {pagination.isError && (
        <Alert
          variant="error"
          title={t(['Failed to load orders', 'فشل تحميل الطلبات'])}
          description={t([
            'There was a problem retrieving quick outbound orders.',
            'حدثت مشكلة أثناء جلب طلبات الإخراج السريع.',
          ])}
          className="mb-4"
          onDismiss={() => pagination.refetch()}
        >
          <Alert.Action onClick={() => pagination.refetch()}>
            {t(['Retry', 'إعادة المحاولة'])}
          </Alert.Action>
        </Alert>
      )}

      <FilterPanel
        title={t(['Order filters', 'فلاتر الطلبات'])}
        onApply={applyFilters}
        onReset={resetFilters}
        loading={pagination.isFetching}
        applyLabel={t(['Apply filters', 'تطبيق الفلاتر'])}
        resetLabel={t(['Reset filters', 'إعادة تعيين الفلاتر'])}
      >
        <TextField
          label={t(['Order #', 'رقم الطلب'])}
          value={draftFilters.orderSearch}
          onChange={(event) => setDraft({ orderSearch: event.target.value })}
          placeholder={t(['Search order...', 'ابحث عن الطلب...'])}
          className="font-mono"
        />
        <Combobox
          label={t(['Client', 'العميل'])}
          value={draftFilters.companyId}
          onChange={(value) => setDraft({ companyId: value })}
          options={clientFilterOptions}
          placeholder={t(['All clients', 'كل العملاء'])}
        />
        <SelectField
          label={t(['Status', 'الحالة'])}
          name="quickOutboundStatusFilter"
          value={draftFilters.status}
          onChange={(event) => setDraft({ status: event.target.value })}
          options={statusFilterOptions}
        />
        <TextField
          label={t(['Created from', 'تاريخ الإنشاء من'])}
          type="date"
          value={draftFilters.createdFrom}
          onChange={(event) => setDraft({ createdFrom: event.target.value })}
        />
        <TextField
          label={t(['Created to', 'تاريخ الإنشاء إلى'])}
          type="date"
          value={draftFilters.createdTo}
          onChange={(event) => setDraft({ createdTo: event.target.value })}
        />
      </FilterPanel>

      <DataTable
        columns={columns}
        rows={pagination.rows}
        rowKey={(order) => order.id}
        serverPagination={pagination.serverPagination}
        loading={pagination.isInitialLoading || !warehouseId}
        onRowClick={(order) => navigate(`/orders/outbound/${order.id}`)}
        empty={
          warehouseId
            ? t([
                'No quick outbound orders match the filters.',
                'لا توجد طلبات إخراج سريع مطابقة للفلاتر.',
              ])
            : t(['Warehouse not resolved yet.', 'لم يتم تحديد المستودع بعد.'])
        }
        labels={{
          rowsSuffix: t(['rows', 'صف']),
          resultsSuffix: t(['results', 'نتيجة']),
          ofWord: t(['of', 'من']),
          previous: t(['Previous', 'السابق']),
          next: t(['Next', 'التالي']),
          rowsPerPageAria: t(['Rows per page', 'عدد الصفوف لكل صفحة']),
        }}
      />

      <CreateQuickDirectedOutboundModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        loading={createMut.isPending}
        onSubmit={(input) => createMut.mutate(input)}
      />

      <Modal
        open={successResult != null}
        onClose={() => setSuccessResult(null)}
        title={t(['Outbound successful', 'تم الإخراج بنجاح'])}
        widthClass="max-w-xl"
        footer={
          <div className="flex flex-wrap justify-end gap-3">
            {successResult ? (
              <Link
                to={`/orders/outbound/${successResult.orderId}`}
                className="inline-flex h-9 items-center rounded-lg border border-border bg-surface-card px-3 text-sm font-medium text-text-body hover:bg-surface-hover"
                onClick={() => setSuccessResult(null)}
              >
                {t(['View order', 'عرض الطلب'])}
              </Link>
            ) : null}
            <Button type="button" variant="primary" onClick={() => setSuccessResult(null)}>
              {t(['Done', 'تم'])}
            </Button>
          </div>
        }
      >
        {successResult ? (
          <div className="space-y-4 text-sm text-text-body">
            <p className="text-base font-medium text-brand-700">
              {isArabic ? successResult.messageAr : successResult.messageEn}
            </p>
            <div className="rounded-lg border border-border-subtle bg-surface-card-muted p-4">
              <p className="font-medium text-text-strong">{successResult.product.name}</p>
              <p className="font-mono text-xs text-text-muted">{successResult.product.sku}</p>
              <p className="mt-2 text-text-body">
                {t(['Order', 'الطلب'])}:{' '}
                <span className="font-mono">{successResult.orderNumber}</span>
              </p>
            </div>
            <ul className="space-y-2">
              {successResult.directedPick.map((slice) => (
                <li
                  key={`${slice.locationId}-${slice.quantity}`}
                  className="flex items-start justify-between gap-3 rounded-lg border border-border-subtle bg-surface-card-muted px-3 py-2"
                >
                  <span className="font-medium text-text-strong">{slice.locationLabel}</span>
                  <span className="shrink-0 font-mono text-brand-700">{slice.quantity}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Modal>
    </AdminListPageShell>
  );
}
