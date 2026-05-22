import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { AdjustmentsApi, type StockAdjustment } from '../api/adjustments';
import { CompaniesApi } from '../api/companies';
import { ProductsApi } from '../api/products';
import { NewAdjustmentModal } from '../components/adjustments/NewAdjustmentModal';
import { AnchoredDropdown } from '../components/AnchoredDropdown';
import { Button } from '../components/Button';
import { StatusBadge } from '../components/StatusBadge';
import { Combobox } from '../components/Combobox';
import { ConfirmModal } from '../components/ConfirmModal';
import { Column, DataTable } from '../components/DataTable';
import { FilterPanel } from '../components/FilterPanel';
import { TextField } from '../components/TextField';
import { useToast } from '../components/ToastProvider';
import { QK } from '../constants/query-keys';
import { useDefaultWarehouseId } from '../hooks/useDefaultWarehouse';
import { useFilters } from '../hooks/useFilters';
import { companyFilterComboboxOptions } from '../lib/company-filter-options';

type AdjListDraft = {
  adjustmentId: string;
  productId: string;
  clientId: string;
  lotId: string;
  createdFrom: string;
  createdTo: string;
};

export function AdjustmentsPage() {
  const isArabic =
    typeof window !== 'undefined' &&
    (window.localStorage.getItem('wms-ui-language') === 'AR' || document.documentElement.dir === 'rtl');
  const t = (en: string, ar: string) => (isArabic ? ar : en);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const deepLinkAdjustmentId = searchParams.get('adjustmentId')?.trim() || '';
  const [newModalOpen, setNewModalOpen] = useState(false);
  const [draftDeleteTarget, setDraftDeleteTarget] = useState<StockAdjustment | null>(null);
  const [openActionId, setOpenActionId] = useState<string | null>(null);

  useEffect(() => {
    if (!openActionId) return;
    const onPointerDown = (ev: PointerEvent) => {
      const target = ev.target as Element | null;
      if (!target) return;
      if (
        target.closest('[data-adjustment-action-trigger="true"]') ||
        target.closest('[data-adjustment-action-menu="true"]') ||
        target.closest('[data-adjustment-action-menu-button="true"]')
      ) {
        return;
      }
      setOpenActionId(null);
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [openActionId]);

  useEffect(() => {
    if (!deepLinkAdjustmentId) return;
    const next = new URLSearchParams(searchParams);
    next.delete('adjustmentId');
    setSearchParams(next, { replace: true });
    navigate(`/inventory/adjustments/${deepLinkAdjustmentId}`);
  }, [deepLinkAdjustmentId, navigate, searchParams, setSearchParams]);

  const { warehouseId: wid } = useDefaultWarehouseId();

  const initialAdj = useMemo<AdjListDraft>(
    () => ({
      adjustmentId: '',
      productId: '',
      clientId: '',
      lotId: '',
      createdFrom: '',
      createdTo: '',
    }),
    [],
  );

  const { draftFilters, appliedFilters, setDraft, applyFilters, resetFilters } =
    useFilters(initialAdj);

  const listParams = useMemo(
    () => ({
      warehouseId: wid || undefined,
      companyId: appliedFilters.clientId || undefined,
      adjustmentId: appliedFilters.adjustmentId.trim() || undefined,
      productId: appliedFilters.productId || undefined,
      lotId: appliedFilters.lotId.trim() || undefined,
      createdFrom: appliedFilters.createdFrom.trim() || undefined,
      createdTo: appliedFilters.createdTo.trim() || undefined,
      limit: 100,
    }),
    [appliedFilters, wid],
  );

  const list = useQuery({
    queryKey: [...QK.adjustments, listParams],
    queryFn: () => AdjustmentsApi.list(listParams),
    enabled: !!wid,
  });

  const companies = useQuery({
    queryKey: QK.companies,
    queryFn: () => CompaniesApi.list(),
    staleTime: 10 * 60_000,
  });

  const clientListFilterOptions = useMemo(
    () => companyFilterComboboxOptions(companies.data, t('All clients', 'كل العملاء')),
    [companies.data, isArabic],
  );

  const productDraftOptions = useQuery({
    queryKey: [...QK.products, 'adjustments-draft-products', draftFilters.clientId || '__all__'],
    queryFn: () =>
      ProductsApi.list({
        companyId: draftFilters.clientId || undefined,
        limit: 300,
      }),
    enabled: !!wid,
    staleTime: 5 * 60_000,
  });

  const discardDraftMut = useMutation({
    mutationFn: AdjustmentsApi.cancel,
    onSuccess: () => {
      toast.success(t('Draft deleted.', 'تم حذف المسودة.'));
      qc.invalidateQueries({ queryKey: QK.adjustments });
      setDraftDeleteTarget(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const adjustmentCols: Column<StockAdjustment>[] = useMemo(
    () => [
      { header: t('Client name', 'اسم العميل'), accessor: (a) => a.company?.name ?? '—', width: '160px' },
      {
        header: t('Status', 'الحالة'),
        accessor: (a) => <StatusBadge status={a.status} />,
        width: '120px',
      },
      {
        header: t('Adjustment id', 'معرف التعديل'),
        accessor: (a) => <span className="font-mono text-[11px]">{a.id}</span>,
        width: '280px',
      },
      {
        header: t('Lines', 'البنود'),
        accessor: (a) => <span className="font-mono text-xs">{a.lines?.length ?? 0}</span>,
        width: '72px',
        className: 'text-right',
      },
      {
        header: t('Date', 'التاريخ'),
        accessor: (a) => new Date(a.createdAt).toLocaleString(),
        width: '168px',
      },
      {
        header: t('Actions', 'الإجراءات'),
        accessor: (a) => (
          <div onClick={(e) => e.stopPropagation()}>
            <AnchoredDropdown
              open={openActionId === a.id}
              align="end"
              menuRootProps={{ 'data-adjustment-action-menu': 'true' }}
              trigger={
                <button
                  type="button"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 transition hover:bg-slate-100"
                  data-adjustment-action-trigger="true"
                  onClick={() => setOpenActionId((cur) => (cur === a.id ? null : a.id))}
                  aria-label={t('Open actions', 'فتح الإجراءات')}
                  aria-expanded={openActionId === a.id}
                  aria-haspopup="menu"
                >
                  <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden>
                    <path d="M4 10a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Zm4.5 0a1.5 1.5 0 1 1 3.001 0A1.5 1.5 0 0 1 8.5 10ZM13 10a1.5 1.5 0 1 1 3.001 0A1.5 1.5 0 0 1 13 10Z" />
                  </svg>
                </button>
              }
            >
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100"
                data-adjustment-action-menu-button="true"
                onClick={() => {
                  setOpenActionId(null);
                  navigate(`/inventory/adjustments/${a.id}`);
                }}
              >
                {a.status === 'draft' ? t('Edit', 'تعديل') : t('Open', 'فتح')}
              </button>
              {a.status === 'draft' ? (
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left text-sm text-rose-700 transition hover:bg-rose-50"
                  data-adjustment-action-menu-button="true"
                  onClick={() => {
                    setOpenActionId(null);
                    setDraftDeleteTarget(a);
                  }}
                >
                  {t('Delete', 'حذف')}
                </button>
              ) : null}
            </AnchoredDropdown>
          </div>
        ),
        width: '120px',
      },
    ],
    [isArabic, navigate, openActionId],
  );

  return (
    <>
      {!wid ? (
        <p className="mb-3 text-sm text-slate-600">Resolve warehouse configuration…</p>
      ) : null}

      <FilterPanel
        title={t('Adjustment filters', 'فلاتر التعديلات')}
        onApply={applyFilters}
        onReset={resetFilters}
        loading={list.isFetching}
        applyLabel={t('Apply filters', 'تطبيق الفلاتر')}
        resetLabel={t('Reset filters', 'إعادة تعيين الفلاتر')}
      >
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          <TextField
            label={t('Adjustment id', 'معرف التعديل')}
            value={draftFilters.adjustmentId}
            onChange={(e) => setDraft({ adjustmentId: e.target.value })}
            className="font-mono text-xs"
          />
          <Combobox
            label={t('Client', 'العميل')}
            value={draftFilters.clientId}
            onChange={(v) => setDraft({ clientId: v })}
            options={clientListFilterOptions}
            placeholder={t('All clients', 'كل العملاء')}
          />
          <Combobox
            label={t('Product', 'المنتج')}
            value={draftFilters.productId}
            onChange={(v) => setDraft({ productId: v })}
            options={(productDraftOptions.data?.items ?? []).map((p) => ({
              value: p.id,
              label: draftFilters.clientId
                ? `${p.sku} — ${p.name}`
                : `${p.sku} — ${p.name}${p.company?.name ? ` (${p.company.name})` : ''}`,
            }))}
            placeholder={t('All products', 'كل المنتجات')}
          />
          <TextField
            label={t('Lot id', 'معرف الدفعة')}
            value={draftFilters.lotId}
            onChange={(e) => setDraft({ lotId: e.target.value })}
            className="font-mono text-xs"
          />
          <TextField
            label={t('Created from', 'تاريخ الإنشاء من')}
            type="date"
            value={draftFilters.createdFrom}
            onChange={(e) => setDraft({ createdFrom: e.target.value })}
          />
          <TextField
            label={t('Created to', 'تاريخ الإنشاء إلى')}
            type="date"
            value={draftFilters.createdTo}
            onChange={(e) => setDraft({ createdTo: e.target.value })}
          />
        </div>
      </FilterPanel>

      <DataTable
        title={t('Stock adjustments', 'تعديلات المخزون')}
        actions={
          <Button
            disabled={!wid}
            variant="brand"
            onClick={() => wid && setNewModalOpen(true)}
          >
            {t('+ New adjustment', '+ تعديل جديد')}
          </Button>
        }
        columns={adjustmentCols}
        rows={list.data?.items ?? []}
        rowKey={(a) => a.id}
        loading={list.isLoading || !wid}
        empty={wid ? 'No adjustments match the filters.' : 'Warehouse not resolved yet.'}
        onRowClick={(a) => navigate(`/inventory/adjustments/${a.id}`)}
        labels={{
          rowsSuffix: t('rows', 'صف'),
          resultsSuffix: t('results', 'نتيجة'),
          ofWord: t('of', 'من'),
          previous: t('Previous', 'السابق'),
          next: t('Next', 'التالي'),
          rowsPerPageAria: t('Rows per page', 'عدد الصفوف لكل صفحة'),
        }}
      />

      <NewAdjustmentModal
        open={newModalOpen}
        warehouseId={wid ?? ''}
        onClose={() => setNewModalOpen(false)}
      />

      <ConfirmModal
        open={!!draftDeleteTarget}
        title={t('Delete this draft?', 'حذف هذه المسودة؟')}
        confirmLabel={t('Delete', 'حذف')}
        danger
        loading={discardDraftMut.isPending}
        onClose={() => !discardDraftMut.isPending && setDraftDeleteTarget(null)}
        onConfirm={() => {
          if (draftDeleteTarget) discardDraftMut.mutate(draftDeleteTarget.id);
        }}
      >
        <p className="text-sm">
          {t(
            'This removes the draft and its lines. This cannot be undone.',
            'سيؤدي هذا إلى حذف المسودة وبنودها. لا يمكن التراجع عن ذلك.',
          )}
        </p>
      </ConfirmModal>
    </>
  );
}
