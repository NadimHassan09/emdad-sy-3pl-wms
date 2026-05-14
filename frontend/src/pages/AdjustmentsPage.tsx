import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';

import {
  ADJUSTMENT_REASON_PENDING,
  AdjustmentsApi,
  CreateAdjustmentInput,
  StockAdjustment,
  StockAdjustmentLine,
} from '../api/adjustments';
import { CompaniesApi } from '../api/companies';
import { InventoryApi, StockRow } from '../api/inventory';
import { LocationsApi } from '../api/locations';
import { ProductsApi } from '../api/products';
import { BarcodeScanModal } from '../components/BarcodeScanModal';
import { Button } from '../components/Button';
import { StatusBadge } from '../components/StatusBadge';
import { Combobox } from '../components/Combobox';
import { ConfirmModal } from '../components/ConfirmModal';
import { Column, DataTable } from '../components/DataTable';
import { FilterActions } from '../components/FilterActions';
import { FilterPanel } from '../components/FilterPanel';
import { Modal } from '../components/Modal';
import { PageHeader } from '../components/PageHeader';
import { TextField } from '../components/TextField';
import { useToast } from '../components/ToastProvider';
import { QK } from '../constants/query-keys';
import { useDefaultWarehouseId } from '../hooks/useDefaultWarehouse';
import { useFilters } from '../hooks/useFilters';
import { companyFilterComboboxOptions } from '../lib/company-filter-options';
import { isAdjustmentStockLocationType } from '../lib/location-types';

type AdjListDraft = {
  adjustmentId: string;
  productId: string;
  clientId: string;
  lotId: string;
  createdFrom: string;
  createdTo: string;
};

type AdjustmentDrawerState =
  | { mode: 'new' }
  | { mode: 'edit'; adjustment: StockAdjustment };

export function AdjustmentsPage() {
  const isArabic =
    typeof window !== 'undefined' && (window.localStorage.getItem('wms-ui-language') === 'AR' || document.documentElement.dir === 'rtl');
  const t = (en: string, ar: string) => (isArabic ? ar : en);
  const qc = useQueryClient();
  const toast = useToast();
  const [adjDrawer, setAdjDrawer] = useState<AdjustmentDrawerState | null>(null);
  const [draftDeleteTarget, setDraftDeleteTarget] = useState<StockAdjustment | null>(null);
  const [detailAdjustment, setDetailAdjustment] = useState<StockAdjustment | null>(null);
  const [openActionId, setOpenActionId] = useState<string | null>(null);
  useEffect(() => {
    if (!openActionId) return;
    const onPointerDown = (ev: PointerEvent) => {
      const target = ev.target as Element | null;
      if (!target) return;
      if (
        target.closest('[data-adjustment-action-trigger="true"]') ||
        target.closest('[data-adjustment-action-menu-button="true"]')
      ) {
        return;
      }
      setOpenActionId(null);
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [openActionId]);


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

  const createMut = useMutation({
    mutationFn: AdjustmentsApi.create,
    onSuccess: (adj) => {
      toast.success('Adjustment draft created.');
      qc.invalidateQueries({ queryKey: QK.adjustments });
      setAdjDrawer({ mode: 'edit', adjustment: adj });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const discardDraftMut = useMutation({
    mutationFn: AdjustmentsApi.cancel,
    onSuccess: (_data, deletedId: string) => {
      toast.success('Draft deleted.');
      qc.invalidateQueries({ queryKey: QK.adjustments });
      setAdjDrawer((cur) =>
        cur?.mode === 'edit' && cur.adjustment.id === deletedId ? null : cur,
      );
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
          <div className="relative inline-flex" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 transition hover:bg-slate-100"
              data-adjustment-action-trigger="true"
              onClick={() => setOpenActionId((cur) => (cur === a.id ? null : a.id))}
              aria-label="Open actions"
              aria-expanded={openActionId === a.id}
            >
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden>
                <path d="M4 10a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Zm4.5 0a1.5 1.5 0 1 1 3.001 0A1.5 1.5 0 0 1 8.5 10ZM13 10a1.5 1.5 0 1 1 3.001 0A1.5 1.5 0 0 1 13 10Z" />
              </svg>
            </button>
            {openActionId === a.id ? (
              <div className="absolute right-0 top-9 z-10 min-w-[140px] overflow-hidden rounded-md border border-slate-200 bg-white shadow-md">
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100"
                  data-adjustment-action-menu-button="true"
                  onClick={() => {
                    setOpenActionId(null);
                    setAdjDrawer({ mode: 'edit', adjustment: a });
                  }}
                >
                  {a.status === 'draft' ? 'Edit' : 'Open'}
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
                    Delete
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        ),
        width: '120px',
      },
    ],
    [isArabic, openActionId],
  );

  const adjustmentLineDetailCols: Column<StockAdjustmentLine>[] = useMemo(
    () => [
      { header: 'Product name', accessor: (l) => l.product.name, width: '200px' },
      {
        header: 'SKU',
        accessor: (l) => <span className="font-mono text-xs">{l.product.sku}</span>,
        width: '120px',
      },
      {
        header: 'Barcode',
        accessor: (l) =>
          !l.product.barcode?.trim() ? (
            <span className="text-slate-400">—</span>
          ) : (
            <span className="font-mono text-[11px]">{l.product.barcode}</span>
          ),
        width: '130px',
      },
      {
        header: 'Lot id',
        accessor: (l) => (
          <span className="font-mono text-[10px]">{l.lot?.id ?? l.lotId ?? '—'}</span>
        ),
        width: '200px',
      },
      {
        header: 'Before',
        accessor: (l) => (
          <span className="font-mono text-xs">
            {Number(l.quantityBefore).toLocaleString(undefined, { maximumFractionDigits: 4 })}
          </span>
        ),
        width: '100px',
        className: 'text-right',
      },
      {
        header: 'After',
        accessor: (l) => (
          <span className="font-mono text-xs">
            {Number(l.quantityAfter).toLocaleString(undefined, { maximumFractionDigits: 4 })}
          </span>
        ),
        width: '100px',
        className: 'text-right',
      },
    ],
    [],
  );

  return (
    <>
      <PageHeader
        title={t('Stock adjustments', 'تعديلات المخزون')}
        actions={
          <Button
            disabled={!wid}
            onClick={() => wid && setAdjDrawer({ mode: 'new' })}
            className="border border-[#1a7a44] bg-[#1a7a44] text-white hover:bg-[#146135]"
          >
            {t('+ New adjustment', '+ تعديل جديد')}
          </Button>
        }
      />

      {!wid ? (
        <p className="mb-3 text-sm text-slate-600">Resolve warehouse configuration…</p>
      ) : null}

      <FilterPanel showLabel={t('Show filters', 'إظهار الفلاتر')} hideLabel={t('Hide filters', 'إخفاء الفلاتر')}>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
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
      <FilterActions
        onApply={applyFilters}
        onReset={resetFilters}
        loading={list.isFetching}
        applyLabel={t('Apply filters', 'تطبيق الفلاتر')}
        resetLabel={t('Reset filters', 'إعادة تعيين الفلاتر')}
      />
      </FilterPanel>

      <DataTable
        columns={adjustmentCols}
        rows={list.data?.items ?? []}
        rowKey={(a) => a.id}
        loading={list.isLoading || !wid}
        empty={wid ? 'No adjustments match the filters.' : 'Warehouse not resolved yet.'}
        onRowClick={(a) => setDetailAdjustment(a)}
        labels={{
          rowsSuffix: t('rows', 'صف'),
          resultsSuffix: t('results', 'نتيجة'),
          ofWord: t('of', 'من'),
          previous: t('Previous', 'السابق'),
          next: t('Next', 'التالي'),
          rowsPerPageAria: t('Rows per page', 'عدد الصفوف لكل صفحة'),
        }}
      />

      <Modal
        open={!!detailAdjustment}
        onClose={() => setDetailAdjustment(null)}
        title={detailAdjustment ? `Lines · ${detailAdjustment.id.slice(0, 8)}…` : 'Lines'}
        widthClass="max-w-5xl"
        footer={
          <Button type="button" variant="secondary" onClick={() => setDetailAdjustment(null)}>
            {t('Close', 'إغلاق')}
          </Button>
        }
      >
        {detailAdjustment ? (
          <div className="space-y-3 text-sm">
            <div className="rounded-md bg-slate-50 px-3 py-2 text-slate-700">
              <div>
                <span className="text-slate-500">{t('Client:', 'العميل:')}</span> {detailAdjustment.company?.name ?? '—'}
              </div>
              <div className="mt-1">
                <span className="text-slate-500">{t('Status:', 'الحالة:')}</span> <StatusBadge status={detailAdjustment.status} />
              </div>
              <div className="mt-1 max-w-full truncate text-xs" title={detailAdjustment.reason}>
                <span className="text-slate-500">{t('Reason:', 'السبب:')}</span>{' '}
                {detailAdjustment.reason === ADJUSTMENT_REASON_PENDING ? (
                  <span className="text-slate-400 italic">{t('(pending)', '(قيد الانتظار)')}</span>
                ) : (
                  detailAdjustment.reason
                )}
              </div>
            </div>
            <DataTable
              columns={adjustmentLineDetailCols}
              rows={detailAdjustment.lines ?? []}
              rowKey={(l) => l.id}
              empty={t('No lines on this adjustment.', 'لا توجد بنود في هذا التعديل.')}
            />
          </div>
        ) : null}
      </Modal>

      {adjDrawer && wid ? (
        <AdjustmentDetailDrawer
          key={adjDrawer.mode === 'new' ? 'new' : adjDrawer.adjustment.id}
          drawerState={adjDrawer}
          warehouseId={wid}
          onClose={() => setAdjDrawer(null)}
          onCreateDraft={(input) => createMut.mutate(input)}
          createDraftPending={createMut.isPending}
        />
      ) : null}

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
          This removes draft <strong>{draftDeleteTarget?.id.slice(0, 8)}</strong> and its lines. This
          cannot be undone.
        </p>
      </ConfirmModal>
    </>
  );
}

function AdjustmentDetailDrawer({
  drawerState,
  warehouseId,
  onClose,
  onCreateDraft,
  createDraftPending,
}: {
  drawerState: AdjustmentDrawerState;
  warehouseId: string;
  onClose: () => void;
  onCreateDraft: (input: CreateAdjustmentInput) => void;
  createDraftPending: boolean;
}) {
  const isArabic =
    typeof window !== 'undefined' && (window.localStorage.getItem('wms-ui-language') === 'AR' || document.documentElement.dir === 'rtl');
  const t = (en: string, ar: string) => (isArabic ? ar : en);
  const qc = useQueryClient();
  const toast = useToast();
  const isNew = drawerState.mode === 'new';
  const id = isNew ? '' : drawerState.adjustment.id;

  const [newCompanyId, setNewCompanyId] = useState('');
  const [newReason, setNewReason] = useState('');
  const [isNewClientComboboxActive, setIsNewClientComboboxActive] = useState(false);
  const newClientComboboxWrapRef = useRef<HTMLDivElement>(null);
  const companiesForNew = useQuery({
    queryKey: QK.companies,
    queryFn: () => CompaniesApi.list(),
    enabled: isNew,
    staleTime: 10 * 60_000,
  });

  const detail = useQuery({
    queryKey: [...QK.adjustments, id],
    queryFn: () => AdjustmentsApi.get(id),
    enabled: !isNew && !!id && id.length === 36,
  });

  const adj = isNew ? null : (detail.data ?? drawerState.adjustment);

  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);

  useEffect(() => {
    setCancelConfirmOpen(false);
  }, [drawerState]);

  const addLineMut = useMutation({
    mutationFn: ({
      adjustmentId,
      body,
    }: {
      adjustmentId: string;
      body: Parameters<typeof AdjustmentsApi.addLine>[1];
    }) => AdjustmentsApi.addLine(adjustmentId, body),
    onSuccess: () => {
      toast.success('Line added.');
      qc.invalidateQueries({ queryKey: QK.adjustments });
      qc.invalidateQueries({ queryKey: [...QK.adjustments, id] });
      qc.invalidateQueries({ queryKey: QK.inventoryStock });
      qc.invalidateQueries({ queryKey: QK.inventoryStockByProduct });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const approveMut = useMutation({
    mutationFn: AdjustmentsApi.approve,
    onSuccess: () => {
      toast.success('Adjustment approved; stock updated.');
      qc.invalidateQueries({ queryKey: QK.adjustments });
      qc.invalidateQueries({ queryKey: [...QK.adjustments, id] });
      qc.invalidateQueries({ queryKey: QK.inventoryStock });
      qc.invalidateQueries({ queryKey: QK.inventoryStockByProduct });
      qc.invalidateQueries({ queryKey: QK.ledger });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelMut = useMutation({
    mutationFn: AdjustmentsApi.cancel,
    onSuccess: () => {
      toast.success('Draft deleted.');
      qc.invalidateQueries({ queryKey: QK.adjustments });
      qc.invalidateQueries({ queryKey: QK.inventoryStock });
      qc.invalidateQueries({ queryKey: QK.inventoryStockByProduct });
      qc.invalidateQueries({ queryKey: QK.ledger });
      setCancelConfirmOpen(false);
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createDraftSubmit = (e: FormEvent) => {
    e.preventDefault();
    const reason = newReason.trim();
    if (!warehouseId || !newCompanyId.trim() || !reason) return;
    onCreateDraft({ warehouseId, companyId: newCompanyId.trim(), reason });
  };

  if (isNew) {
    return (
      <Modal
        open
        onClose={() => !createDraftPending && onClose()}
        title={t('Adjustment · draft', 'تعديل · مسودة')}
        widthClass="max-w-lg"
        footer={
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={createDraftPending}>
              {t('Close', 'إغلاق')}
            </Button>
            <Button
              type="submit"
              form="adj-new-draft"
              loading={createDraftPending}
              disabled={!warehouseId || !newCompanyId.trim() || !newReason.trim()}
              className="border border-[#1a7a44] bg-[#1a7a44] text-white hover:bg-[#146135]"
            >
              {t('Create draft', 'إنشاء مسودة')}
            </Button>
          </div>
        }
      >
        <form
          id="adj-new-draft"
          onSubmit={createDraftSubmit}
          className={`space-y-3 overflow-visible pr-1 text-sm transition-[max-height] duration-300 ease-in-out ${
            isNewClientComboboxActive ? 'max-h-[100vh]' : 'max-h-[calc(100vh-220px)]'
          }`}
        >
          {!warehouseId ? (
            <p className="text-sm text-rose-600">{t('Cannot create — default warehouse not resolved.', 'لا يمكن الإنشاء — المستودع الافتراضي غير محدد.')}</p>
          ) : null}
          <div
            ref={newClientComboboxWrapRef}
            onFocusCapture={() => setIsNewClientComboboxActive(true)}
            onBlurCapture={() => {
              window.setTimeout(() => {
                if (!newClientComboboxWrapRef.current?.contains(document.activeElement)) {
                  setIsNewClientComboboxActive(false);
                }
              }, 0);
            }}
          >
            <Combobox
              label={t('Client', 'العميل')}
              required
              value={newCompanyId}
              onChange={setNewCompanyId}
              dropdownInFlow
              options={(companiesForNew.data ?? []).map((c) => ({
                value: c.id,
                label: c.name,
              }))}
              placeholder={t('Select client…', 'اختر العميل…')}
            />
          </div>
          <TextField
            label={t('Reason', 'السبب')}
            required
            value={newReason}
            onChange={(e) => setNewReason(e.target.value)}
            placeholder={t('Why is inventory changing?', 'لماذا يتغير المخزون؟')}
          />
        </form>
      </Modal>
    );
  }

  if (!adj) return null;

  const linesForTable = adj.lines ?? [];

  const lineCols: Column<StockAdjustmentLine>[] = [
    { header: 'SKU', accessor: (l) => <span className="font-mono text-xs">{l.product.sku}</span> },
    { header: 'Location', accessor: (l) => l.location.fullPath, width: '200px' },
    {
      header: 'Lot',
      accessor: (l) => (l.lot ? <span className="font-mono text-xs">{l.lot.lotNumber}</span> : '—'),
      width: '120px',
    },
    {
      header: 'Before → After',
      accessor: (l) => (
        <span className="font-mono text-xs">
          {Number(l.quantityBefore).toLocaleString()} → {Number(l.quantityAfter).toLocaleString()}
        </span>
      ),
    },
  ];

  return (
    <>
      <Modal
        open
        onClose={onClose}
        title={`${t('Adjustment', 'تعديل')} · ${adj.status}`}
        widthClass="max-w-3xl"
        footer={
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              {t('Close', 'إغلاق')}
            </Button>
            {adj.status === 'draft' && (
              <>
                <Button
                  type="button"
                  variant="danger"
                  onClick={() => setCancelConfirmOpen(true)}
                  disabled={cancelMut.isPending}
                >
                  {t('Delete draft', 'حذف المسودة')}
                </Button>
                <Button
                  type="button"
                  loading={approveMut.isPending}
                  className="border border-[#1a7a44] bg-[#1a7a44] text-white hover:bg-[#146135]"
                  onClick={() => {
                    const r = adj.reason?.trim() ?? '';
                    if (!r || r === ADJUSTMENT_REASON_PENDING) {
                      toast.error(t('Enter and save an adjustment reason before approving.', 'أدخل واحفظ سبب التعديل قبل الاعتماد.'));
                      return;
                    }
                    approveMut.mutate(adj.id);
                  }}
                >
                  {t('Approve', 'اعتماد')}
                </Button>
              </>
            )}
          </div>
        }
      >
        <div className="max-h-[calc(100vh-220px)] space-y-4 overflow-y-auto pr-1 text-sm">
          <div className="rounded-md bg-slate-50 p-3 text-slate-700">
            <div>
              <span className="text-slate-500">{t('Warehouse:', 'المستودع:')}</span> {adj.warehouse.code} —{' '}
              {adj.warehouse.name}
            </div>
            <div className="mt-1">
              <span className="text-slate-500">{t('Client:', 'العميل:')}</span> {adj.company.name}
            </div>
          </div>

          <DataTable
            columns={lineCols}
            rows={linesForTable}
            rowKey={(l) => l.id}
            empty={t('No lines — add targets below.', 'لا توجد بنود — أضف البنود بالأسفل.')}
          />

          {adj.status === 'draft' && (
            <AddAdjustmentLineForm
              adjustment={adj}
              loading={addLineMut.isPending}
              onSubmit={(body) => addLineMut.mutate({ adjustmentId: adj.id, body })}
            />
          )}
        </div>
      </Modal>

      <ConfirmModal
        open={cancelConfirmOpen}
        title={t('Delete this draft?', 'حذف هذه المسودة؟')}
        confirmLabel={t('Delete', 'حذف')}
        danger
        loading={cancelMut.isPending}
        onClose={() => !cancelMut.isPending && setCancelConfirmOpen(false)}
        onConfirm={() => adj.status === 'draft' && cancelMut.mutate(adj.id)}
      >
        <p className="text-sm">
          This removes draft <strong>{adj.id.slice(0, 8)}</strong> and its lines. This cannot be undone.
        </p>
      </ConfirmModal>
    </>
  );
}

function AddAdjustmentLineForm({
  adjustment,
  loading,
  onSubmit,
}: {
  adjustment: StockAdjustment;
  loading: boolean;
  onSubmit: (b: Parameters<typeof AdjustmentsApi.addLine>[1]) => void;
}) {
  const isArabic =
    typeof window !== 'undefined' && (window.localStorage.getItem('wms-ui-language') === 'AR' || document.documentElement.dir === 'rtl');
  const t = (en: string, ar: string) => (isArabic ? ar : en);
  const toast = useToast();
  const [productSearch, setProductSearch] = useState('');
  const [debouncedProductSearch, setDebouncedProductSearch] = useState('');
  const [scanOpen, setScanOpen] = useState(false);
  const [productId, setProductId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [lotId, setLotId] = useState('');
  const [qtyAfter, setQtyAfter] = useState('');

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedProductSearch(productSearch.trim()), 350);
    return () => window.clearTimeout(t);
  }, [productSearch]);

  const products = useQuery({
    queryKey: [...QK.products, adjustment.companyId, 'adj-form', debouncedProductSearch],
    queryFn: () =>
      ProductsApi.list({
        companyId: adjustment.companyId,
        limit: 200,
        ...(debouncedProductSearch ? { search: debouncedProductSearch } : {}),
      }),
    enabled: !!adjustment.companyId,
    staleTime: 60_000,
  });

  const productMeta = useMemo(
    () => (products.data?.items ?? []).find((p) => p.id === productId),
    [products.data?.items, productId],
  );

  useEffect(() => {
    setLotId('');
    setLocationId('');
  }, [productId]);

  useEffect(() => {
    setLotId('');
  }, [locationId]);

  const lots = useQuery({
    queryKey: [...QK.products, productId, 'lots'],
    queryFn: () => ProductsApi.listLots(productId),
    enabled: !!productId && productMeta?.trackingType === 'lot',
    staleTime: 60_000,
  });

  const locs = useQuery({
    queryKey: QK.locationsFlat(adjustment.warehouseId, false),
    queryFn: () => LocationsApi.list(adjustment.warehouseId),
    staleTime: 5 * 60_000,
  });

  const adjustmentLocations = useMemo(
    () => (locs.data ?? []).filter((l) => isAdjustmentStockLocationType(l.type)),
    [locs.data],
  );

  /** All buckets for this product in the warehouse (on-hand &gt; 0 on server). Used for location list + preview. */
  const stockByProduct = useQuery({
    queryKey: [
      ...QK.inventoryStock,
      'adj-line-form-stock',
      adjustment.warehouseId,
      adjustment.companyId,
      productId,
    ],
    queryFn: () =>
      InventoryApi.stock({
        warehouseId: adjustment.warehouseId,
        companyId: adjustment.companyId,
        productId,
        limit: 500,
        offset: 0,
      }),
    enabled: !!productId,
    staleTime: 30_000,
  });

  const adjustmentLocationsWithProduct = useMemo(() => {
    const ids = new Set((stockByProduct.data?.items ?? []).map((r) => r.locationId));
    return adjustmentLocations.filter((l) => ids.has(l.id));
  }, [adjustmentLocations, stockByProduct.data?.items]);

  const validProductLocationIds = useMemo(
    () => new Set(adjustmentLocationsWithProduct.map((l) => l.id)),
    [adjustmentLocationsWithProduct],
  );

  useEffect(() => {
    if (!productId || !locationId) return;
    if (!stockByProduct.isFetched) return;
    if (!validProductLocationIds.has(locationId)) setLocationId('');
  }, [productId, locationId, stockByProduct.isFetched, validProductLocationIds]);

  const stockRow = useMemo((): StockRow | null => {
    const items = stockByProduct.data?.items ?? [];
    if (!productId || !locationId) return null;

    if (productMeta?.trackingType === 'lot') {
      if (!lotId) return null;
      return (
        items.find(
          (r) =>
            r.productId === productId &&
            r.locationId === locationId &&
            (r.lotId === lotId || r.lot?.id === lotId),
        ) ?? null
      );
    }

    return (
      items.find(
        (r) =>
          r.productId === productId &&
          r.locationId === locationId &&
          !(r.lotId ?? r.lot?.id),
      ) ??
      items.find((r) => r.productId === productId && r.locationId === locationId) ??
      null
    );
  }, [stockByProduct.data?.items, productId, locationId, lotId, productMeta?.trackingType]);

  const isLotTracked = productMeta?.trackingType === 'lot';
  const showOnHandPanel =
    !!productId && !!locationId && (!isLotTracked || !!lotId);
  const stockQtyPending = !!productId && stockByProduct.isPending;

  const quantityUom = productMeta?.uom ?? stockRow?.product?.uom ?? '—';

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!productMeta) return;

    const qty = Number(qtyAfter);
    const body: Parameters<typeof AdjustmentsApi.addLine>[1] = {
      productId,
      locationId,
      quantityAfter: qty,
    };

    if (productMeta.trackingType === 'lot') {
      if (!lotId) {
        toast.error(t('Select an existing lot (lot-tracked product).', 'اختر دفعة موجودة (للمنتج المتتبع بالدفعات).'));
        return;
      }
      body.lotId = lotId;
    }

    onSubmit(body);
    setQtyAfter('');
    setLotId('');
  };

  return (
    <div className="space-y-3 rounded-md border border-slate-200 p-3">
      <form onSubmit={submit} className="space-y-2 border-t border-slate-100 pt-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('Add line', 'إضافة بند')}</div>
        <div className="flex flex-wrap items-end gap-2">
          <TextField
            label={t('Search product (name, SKU, barcode)', 'بحث عن منتج (اسم، SKU، باركود)')}
            value={productSearch}
            onChange={(e) => setProductSearch(e.target.value)}
            placeholder={t('Type to filter…', 'اكتب للتصفية…')}
            className="min-w-[200px] flex-1"
          />
          <Button type="button" size="sm" variant="secondary" onClick={() => setScanOpen(true)}>
            {t('Scan barcode', 'مسح الباركود')}
          </Button>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          <Combobox
            label={t('Product', 'المنتج')}
            required
            value={productId}
            onChange={setProductId}
            options={(products.data?.items ?? []).map((p) => ({
              value: p.id,
              label: `${p.sku} — ${p.name}`,
              hint: p.barcode ?? undefined,
            }))}
            placeholder={products.isLoading ? t('Loading…', 'جاري التحميل…') : t('Select product…', 'اختر المنتج…')}
            emptyMessage={t('No products for this client match the search.', 'لا توجد منتجات مطابقة لهذا العميل.')}
          />
          <Combobox
            label={t('Location (storage, fridge, quarantine, scrap)', 'الموقع (تخزين، ثلاجة، حجر، هالك)')}
            required
            value={locationId}
            onChange={setLocationId}
            disabled={!productId || stockByProduct.isPending}
            options={adjustmentLocationsWithProduct.map((l) => ({
              value: l.id,
              label: l.fullPath,
              hint: `${l.type} · ${l.barcode}`,
            }))}
            placeholder={
              !productId
                ? t('Select product first…', 'اختر المنتج أولاً…')
                : stockByProduct.isPending
                  ? t('Loading locations…', 'جاري تحميل المواقع…')
                  : t('Pick location…', 'اختر الموقع…')
            }
            emptyMessage={
              !productId
                ? t('Choose a product to see locations.', 'اختر منتجاً لعرض المواقع.')
                : t('No eligible locations hold this product (on-hand > 0). Receive stock first or pick another product.', 'لا توجد مواقع مؤهلة تحتوي هذا المنتج (كمية > 0). استلم مخزوناً أولاً أو اختر منتجاً آخر.')
            }
          />
        </div>
        {productMeta?.trackingType === 'lot' && (
          <Combobox
            label={t('Lot (required)', 'الدفعة (مطلوب)')}
            required
            value={lotId}
            onChange={setLotId}
            options={(lots.data ?? []).map((lot) => ({
              value: lot.id,
              label: lot.lotNumber,
              hint: lot.expiryDate ? `Exp ${lot.expiryDate.slice(0, 10)}` : undefined,
            }))}
            placeholder={lots.isLoading ? t('Loading lots…', 'جاري تحميل الدفعات…') : t('Pick lot by number', 'اختر الدفعة بالرقم')}
            disabled={lots.isLoading}
            emptyMessage={t('No lots for this product yet — receive or create inventory first.', 'لا توجد دفعات لهذا المنتج بعد — استلم أو أنشئ مخزوناً أولاً.')}
          />
        )}

        {showOnHandPanel ? (
          <div className="rounded border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
            <span className="font-medium text-slate-600">{t('Quantity:', 'الكمية:')}</span>{' '}
            {stockQtyPending ? (
              <span className="text-slate-400">…</span>
            ) : stockRow ? (
              <span className="font-mono font-semibold text-slate-900">
                {(() => {
                  const n = Number(stockRow.quantityOnHand);
                  return Number.isFinite(n)
                    ? n.toLocaleString(undefined, { maximumFractionDigits: 4 })
                    : String(stockRow.quantityOnHand);
                })()}
              </span>
            ) : (
              <span className="font-mono text-slate-500">—</span>
            )}
            <span className="text-slate-500"> · </span>
            <span className="font-medium text-slate-600">{t('UOM:', 'وحدة القياس:')}</span>{' '}
            <span className="uppercase text-slate-800">{quantityUom}</span>
          </div>
        ) : productId && locationId && isLotTracked && !lotId ? (
          <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            {t('Select a lot to see current on-hand for this location.', 'اختر دفعة لعرض الرصيد الحالي لهذا الموقع.')}
          </div>
        ) : null}

        <TextField
          label={t('Qty after approve', 'الكمية بعد الاعتماد')}
          type="number"
          min={0}
          step={0.0001}
          required
          value={qtyAfter}
          onChange={(e) => setQtyAfter(e.target.value)}
        />
        <Button
          type="submit"
          size="sm"
          loading={loading}
          className="border border-[#1a7a44] bg-[#1a7a44] text-white hover:bg-[#146135]"
        >
          {t('Add line', 'إضافة بند')}
        </Button>
      </form>

      <BarcodeScanModal
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onScan={(text) => {
          setProductSearch(text.trim());
          setScanOpen(false);
        }}
        onCameraError={(msg) => toast.error(msg)}
      />
    </div>
  );
}
