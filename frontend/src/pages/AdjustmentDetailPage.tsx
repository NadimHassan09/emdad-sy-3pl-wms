import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import {
  ADJUSTMENT_REASON_PENDING,
  AdjustmentsApi,
  type StockAdjustmentLine,
} from '../api/adjustments';
import { AdjustmentSummaryCard } from '../components/adjustments/AdjustmentSummaryCard';
import { AddAdjustmentLineForm } from '../components/adjustments/AddAdjustmentLineForm';
import { Button } from '../components/Button';
import { Column, DataTable } from '../components/DataTable';
import { ConfirmModal } from '../components/ConfirmModal';
import { useToast } from '../components/ToastProvider';
import { QK } from '../constants/query-keys';
import { useDefaultWarehouseId } from '../hooks/useDefaultWarehouse';

export function AdjustmentDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const { warehouseId: wid } = useDefaultWarehouseId();
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);

  const isArabic =
    typeof window !== 'undefined' &&
    (window.localStorage.getItem('wms-ui-language') === 'AR' || document.documentElement.dir === 'rtl');
  const t = (en: string, ar: string) => (isArabic ? ar : en);

  const detail = useQuery({
    queryKey: [...QK.adjustments, id],
    queryFn: () => AdjustmentsApi.get(id),
    enabled: !!id,
  });

  const adj = detail.data;

  const addLineMut = useMutation({
    mutationFn: (body: Parameters<typeof AdjustmentsApi.addLine>[1]) => AdjustmentsApi.addLine(id, body),
    onSuccess: () => {
      toast.success(t('Line added.', 'تمت إضافة البند.'));
      qc.invalidateQueries({ queryKey: QK.adjustments });
      qc.invalidateQueries({ queryKey: [...QK.adjustments, id] });
      qc.invalidateQueries({ queryKey: QK.inventoryStock });
      qc.invalidateQueries({ queryKey: QK.inventoryStockByProduct });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const approveMut = useMutation({
    mutationFn: () => AdjustmentsApi.approve(id),
    onSuccess: () => {
      toast.success(t('Adjustment confirmed; stock updated.', 'تم تأكيد التعديل وتحديث المخزون.'));
      qc.invalidateQueries({ queryKey: QK.adjustments });
      qc.invalidateQueries({ queryKey: [...QK.adjustments, id] });
      qc.invalidateQueries({ queryKey: QK.inventoryStock });
      qc.invalidateQueries({ queryKey: QK.inventoryStockByProduct });
      qc.invalidateQueries({ queryKey: QK.ledger });
      navigate('/inventory/adjustments');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelMut = useMutation({
    mutationFn: () => AdjustmentsApi.cancel(id),
    onSuccess: () => {
      toast.success(t('Draft deleted.', 'تم حذف المسودة.'));
      qc.invalidateQueries({ queryKey: QK.adjustments });
      qc.invalidateQueries({ queryKey: QK.inventoryStock });
      qc.invalidateQueries({ queryKey: QK.inventoryStockByProduct });
      qc.invalidateQueries({ queryKey: QK.ledger });
      setCancelConfirmOpen(false);
      navigate('/inventory/adjustments');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const lineCols: Column<StockAdjustmentLine>[] = useMemo(
    () => [
      { header: t('Product name', 'اسم المنتج'), accessor: (l) => l.product.name, width: '200px' },
      {
        header: t('SKU', 'SKU'),
        accessor: (l) => <span className="font-mono text-xs">{l.product.sku}</span>,
        width: '120px',
      },
      {
        header: t('Barcode', 'الباركود'),
        accessor: (l) =>
          !l.product.barcode?.trim() ? (
            <span className="text-slate-400">—</span>
          ) : (
            <span className="font-mono text-[11px]">{l.product.barcode}</span>
          ),
        width: '130px',
      },
      {
        header: t('Lot id', 'معرف الدفعة'),
        accessor: (l) => (
          <span className="font-mono text-[10px]">{l.lot?.id ?? l.lotId ?? '—'}</span>
        ),
        width: '200px',
      },
      {
        header: t('Before', 'قبل'),
        accessor: (l) => (
          <span className="font-mono text-xs">
            {Number(l.quantityBefore).toLocaleString(undefined, { maximumFractionDigits: 4 })}
          </span>
        ),
        width: '100px',
        className: 'text-right',
      },
      {
        header: t('After', 'بعد'),
        accessor: (l) => (
          <span className="font-mono text-xs">
            {Number(l.quantityAfter).toLocaleString(undefined, { maximumFractionDigits: 4 })}
          </span>
        ),
        width: '100px',
        className: 'text-right',
      },
    ],
    [isArabic],
  );

  if (!id) return null;
  if (!wid) return <p className="text-sm text-slate-600">Resolve warehouse configuration…</p>;
  if (detail.isLoading) return <p className="text-sm text-slate-500">Loading…</p>;
  if (detail.isError || !adj)
    return <p className="text-sm text-rose-600">Adjustment not found.</p>;

  const isDraft = adj.status === 'draft';

  return (
    <>
      <div className="mb-2 text-sm text-slate-500">
        <Link to="/inventory/adjustments" className="hover:underline">
          ← {t('All adjustments', 'كل التعديلات')}
        </Link>
      </div>

      {isDraft ? (
        <div className="mb-4 flex flex-wrap justify-end gap-2 sm:mb-5">
          <Button type="button" variant="danger" onClick={() => setCancelConfirmOpen(true)}>
            {t('Delete draft', 'حذف المسودة')}
          </Button>
          <Button
            type="button"
            variant="brand"
            loading={approveMut.isPending}
            onClick={() => {
              const r = adj.reason?.trim() ?? '';
              if (!r || r === ADJUSTMENT_REASON_PENDING) {
                toast.error(
                  t('Enter an adjustment reason before confirming.', 'أدخل سبب التعديل قبل التأكيد.'),
                );
                return;
              }
              approveMut.mutate();
            }}
          >
            {t('Confirm', 'تأكيد')}
          </Button>
        </div>
      ) : null}

      <AdjustmentSummaryCard adjustment={adj} t={t} />

      <DataTable
        title={t('Lines', 'البنود')}
        columns={lineCols}
        rows={adj.lines ?? []}
        rowKey={(l) => l.id}
        empty={t('No lines on this adjustment.', 'لا توجد بنود في هذا التعديل.')}
        labels={{
          rowsSuffix: t('rows', 'صف'),
          resultsSuffix: t('results', 'نتيجة'),
          ofWord: t('of', 'من'),
          previous: t('Previous', 'السابق'),
          next: t('Next', 'التالي'),
          rowsPerPageAria: t('Rows per page', 'عدد الصفوف لكل صفحة'),
        }}
      />

      {isDraft && (
        <div className="mt-4">
          <AddAdjustmentLineForm
            scope={{ warehouseId: adj.warehouseId, companyId: adj.companyId }}
            loading={addLineMut.isPending}
            onAdd={(payload) => addLineMut.mutate(payload.body)}
          />
        </div>
      )}

      <ConfirmModal
        open={cancelConfirmOpen}
        title={t('Delete this draft?', 'حذف هذه المسودة؟')}
        confirmLabel={t('Delete', 'حذف')}
        danger
        loading={cancelMut.isPending}
        onClose={() => !cancelMut.isPending && setCancelConfirmOpen(false)}
        onConfirm={() => cancelMut.mutate()}
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
