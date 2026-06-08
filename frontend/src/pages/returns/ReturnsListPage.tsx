import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { ReturnsApi, type ReturnOrderListItem, type ReturnOrderStatus } from '../../api/returns';
import { Alert, FILTER_APPLY_BUTTON_CLASS } from '@ds';
import { Button } from '../../components/Button';
import { Column, DataTable } from '../../components/DataTable';
import { FilterPanel } from '../../components/FilterPanel';
import { NewReturnModal } from '../../components/returns/NewReturnModal';
import { SelectField } from '../../components/SelectField';
import { StatusBadge } from '../../components/StatusBadge';
import { TextField } from '../../components/TextField';
import { useToast } from '../../components/ToastProvider';
import { QK } from '../../constants/query-keys';
import { useDefaultWarehouseId } from '../../hooks/useDefaultWarehouse';
import { useTenantCompanyId } from '../../hooks/useTenantCompanyId';
import { useFilters } from '../../hooks/useFilters';
import {
  CHUNK_SIZE_STANDARD,
  useChunkedServerPagination,
} from '../../hooks/useChunkedServerPagination';
import {
  formatReturnListDisposition,
  formatReturnListQuantities,
} from '../../lib/return-list-summary';

type FilterDraft = {
  status: string;
  orderSearch: string;
  createdFrom: string;
  createdTo: string;
};

function formatDt(iso: string | null | undefined, locale: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(locale, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ReturnsListPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const isArabic =
    typeof window !== 'undefined' &&
    (window.localStorage.getItem('wms-ui-language') === 'AR' || document.documentElement.dir === 'rtl');
  const t = (en: string, ar: string) => (isArabic ? ar : en);
  const locale = isArabic ? 'ar-SY' : 'en-GB';

  const { warehouseId: wid } = useDefaultWarehouseId();
  const companyId = useTenantCompanyId();
  const [createOpen, setCreateOpen] = useState(false);

  const initial = useMemo<FilterDraft>(
    () => ({ status: '', orderSearch: '', createdFrom: '', createdTo: '' }),
    [],
  );
  const { draftFilters, appliedFilters, setDraft, applyFilters, resetFilters } = useFilters(initial);

  const listParams = useMemo(
    () => ({
      companyId: companyId || undefined,
      status: (appliedFilters.status as ReturnOrderStatus) || undefined,
      orderSearch: appliedFilters.orderSearch.trim() || undefined,
      createdFrom: appliedFilters.createdFrom || undefined,
      createdTo: appliedFilters.createdTo || undefined,
    }),
    [appliedFilters, companyId],
  );

  const pagination = useChunkedServerPagination<ReturnOrderListItem>({
    chunkSize: CHUNK_SIZE_STANDARD,
    filterKey: listParams,
    fetchChunk: (offset, limit) => ReturnsApi.list({ ...listParams, offset, limit }),
    rtQueryKeyPrefix: QK.returns.all,
    chunkQueryKeyPrefix: 'return-orders-chunk',
    enabled: !!companyId,
  });

  const createMut = useMutation({
    mutationFn: ReturnsApi.create,
    onSuccess: (order) => {
      toast.success(t('Return created.', 'تم إنشاء الإرجاع.'));
      qc.invalidateQueries({ queryKey: QK.returns.all });
      setCreateOpen(false);
      navigate(`/returns/${order.id}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cols: Column<ReturnOrderListItem>[] = useMemo(
    () => [
      {
        header: t('Return #', 'رقم الإرجاع'),
        accessor: (r) => (
          <Link to={`/returns/${r.id}`} className="font-mono text-xs font-semibold text-sky-800 hover:underline">
            {r.orderNumber}
          </Link>
        ),
        width: '120px',
      },
      {
        header: t('Status', 'الحالة'),
        accessor: (r) => <StatusBadge status={r.status} />,
        width: '110px',
      },
      {
        header: t('Products', 'المنتجات'),
        accessor: (r) => (
          <span className="text-xs text-slate-700" title={r.summary?.productSummary}>
            {r.summary?.productSummary ?? '—'}
          </span>
        ),
        width: '140px',
      },
      {
        header: t('Qty', 'الكمية'),
        accessor: (r) => (
          <span className="font-mono text-xs text-slate-700">
            {formatReturnListQuantities(r.summary)}
          </span>
        ),
        width: '96px',
        className: 'text-right',
      },
      {
        header: t('Outbound', 'الصادر'),
        accessor: (r) =>
          r.originalOutbound ? (
            <Link
              to={`/orders/outbound/${r.originalOutbound.id}`}
              className="font-mono text-[11px] text-sky-800 hover:underline"
            >
              {r.originalOutbound.orderNumber}
            </Link>
          ) : (
            '—'
          ),
        width: '110px',
      },
      {
        header: t('Disposition', 'التصرف'),
        accessor: (r) => (
          <span className="text-xs text-slate-600">
            {formatReturnListDisposition(r.summary, isArabic)}
          </span>
        ),
        width: '100px',
      },
      {
        header: t('Created', 'أُنشئ'),
        accessor: (r) => (
          <span className="whitespace-nowrap text-[11px] text-slate-600">{formatDt(r.createdAt, locale)}</span>
        ),
        width: '120px',
      },
      {
        header: t('Processed', 'معالج'),
        accessor: (r) => (
          <span className="whitespace-nowrap text-[11px] text-slate-600">{formatDt(r.completedAt, locale)}</span>
        ),
        width: '120px',
      },
      {
        header: '',
        accessor: (r) => {
          const canProcess =
            r.status === 'confirmed' ||
            r.status === 'receiving' ||
            r.status === 'inspecting';
          if (!canProcess) return null;
          return (
            <Link to={`/returns/${r.id}/process`}>
              <Button variant="primary" className="!px-2 !py-1 text-xs">
                {t('Process', 'معالجة')}
              </Button>
            </Link>
          );
        },
        width: '88px',
        className: 'text-right',
      },
    ],
    [isArabic, locale],
  );

  const statusOptions = useMemo(
    () => [
      { value: '', label: t('All', 'الكل') },
      { value: 'draft', label: t('Draft', 'مسودة') },
      { value: 'confirmed', label: t('Confirmed', 'مؤكد') },
      { value: 'receiving', label: t('Receiving', 'استلام') },
      { value: 'inspecting', label: t('Inspecting', 'فحص') },
      { value: 'completed', label: t('Completed', 'مكتمل') },
      { value: 'cancelled', label: t('Cancelled', 'ملغي') },
    ],
    [isArabic],
  );

  return (
    <div>
      {!companyId ? (
        <Alert
          variant="warning"
          title={t('Select a tenant company to list returns.', 'حدد شركة المستأجر لعرض الإرجاعات.')}
          className="mb-4"
        />
      ) : null}

      <FilterPanel
        title={t('Filters', 'الفلاتر')}
        onApply={applyFilters}
        onReset={resetFilters}
        loading={pagination.isFetching}
        applyLabel={t('Apply filters', 'تطبيق الفلاتر')}
        resetLabel={t('Reset filters', 'إعادة تعيين الفلاتر')}
        className="mb-4"
      >
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <TextField
            label={t('Search', 'بحث')}
            value={draftFilters.orderSearch}
            onChange={(e) => setDraft({ ...draftFilters, orderSearch: e.target.value })}
            placeholder={t('Return #, reference…', 'رقم الإرجاع، مرجع…')}
          />
          <SelectField
            label={t('Status', 'الحالة')}
            value={draftFilters.status}
            onChange={(e) => setDraft({ ...draftFilters, status: e.target.value })}
            options={statusOptions}
          />
          <TextField
            label={t('Created from', 'من تاريخ')}
            type="date"
            value={draftFilters.createdFrom}
            onChange={(e) => setDraft({ ...draftFilters, createdFrom: e.target.value })}
          />
          <TextField
            label={t('Created to', 'إلى تاريخ')}
            type="date"
            value={draftFilters.createdTo}
            onChange={(e) => setDraft({ ...draftFilters, createdTo: e.target.value })}
          />
        </div>
      </FilterPanel>

      {pagination.isError ? (
        <Alert
          variant="error"
          title={t('Could not load returns', 'تعذر تحميل الإرجاعات')}
          description={(pagination.error as Error).message}
          className="mb-4"
        />
      ) : null}

      <div className="hidden md:block">
        <DataTable
          title={t('Returns', 'الإرجاعات')}
          description={t(
            'Receive, inspect, and restock customer returns.',
            'استلام وفحص وإعادة مخزون إرجاعات العملاء.',
          )}
          actions={
            <Button
              variant="primary"
              size="md"
              onClick={() => setCreateOpen(true)}
              disabled={!companyId || !wid}
              className={FILTER_APPLY_BUTTON_CLASS}
            >
              {t('+ New return', '+ إرجاع جديد')}
            </Button>
          }
          columns={cols}
          rows={pagination.rows}
          rowKey={(r) => r.id}
          loading={pagination.isInitialLoading || !companyId}
          onRowClick={(r) => navigate(`/returns/${r.id}`)}
          serverPagination={pagination.serverPagination}
          empty={t('No returns match the filters.', 'لا توجد إرجاعات مطابقة.')}
        />
      </div>

          <div className="space-y-2 md:hidden">
        {pagination.rows.map((r) => (
              <article
                key={r.id}
                className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <Link to={`/returns/${r.id}`} className="font-mono text-sm font-semibold text-sky-800">
                    {r.orderNumber}
                  </Link>
                  <StatusBadge status={r.status} />
                </div>
                <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-600">
                  <div className="col-span-2">
                    <dt className="text-slate-400">{t('Products', 'المنتجات')}</dt>
                    <dd>{r.summary?.productSummary ?? '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">{t('Qty', 'الكمية')}</dt>
                    <dd className="font-mono">{formatReturnListQuantities(r.summary)}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">{t('Disposition', 'التصرف')}</dt>
                    <dd>{formatReturnListDisposition(r.summary, isArabic)}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">{t('Outbound', 'الصادر')}</dt>
                    <dd>{r.originalOutbound?.orderNumber ?? '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">{t('Created', 'أُنشئ')}</dt>
                    <dd>{formatDt(r.createdAt, locale)}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">{t('Processed', 'معالج')}</dt>
                    <dd>{formatDt(r.completedAt, locale)}</dd>
                  </div>
                </dl>
                <div className="mt-3 flex gap-2">
                  <Link to={`/returns/${r.id}`} className="flex-1">
                    <Button variant="ghost" className="w-full !py-2 text-xs">
                      {t('Details', 'التفاصيل')}
                    </Button>
                  </Link>
                  {(r.status === 'confirmed' ||
                    r.status === 'receiving' ||
                    r.status === 'inspecting') && (
                    <Link to={`/returns/${r.id}/process`} className="flex-1">
                      <Button variant="primary" className="w-full !py-2 text-xs">
                        {t('Process', 'معالجة')}
                      </Button>
                    </Link>
                  )}
                </div>
              </article>
        ))}
        {pagination.rows.length === 0 ? (
          <p className="text-center text-sm text-slate-500">{t('No returns found.', 'لا إرجاعات.')}</p>
        ) : null}
      </div>

      <NewReturnModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        loading={createMut.isPending}
        warehouseId={wid ?? ''}
        defaultCompanyId={companyId ?? ''}
        onSubmit={(input) => createMut.mutate(input)}
        isArabic={isArabic}
      />
    </div>
  );
}
