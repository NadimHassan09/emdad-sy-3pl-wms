import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ADJUSTMENT_PRIMARY_BUTTON_CLASS } from './adjustment-button-styles';
import { useEffect, useMemo, useRef, useState } from 'react';

import { AdjustmentsApi, type AddAdjustmentLineInput } from '../../api/adjustments';
import { CompaniesApi } from '../../api/companies';
import { Button } from '../Button';
import { Column, DataTable } from '../DataTable';
import { Modal } from '../Modal';
import { Combobox } from '../Combobox';
import { TextField } from '../TextField';
import { useToast } from '../ToastProvider';
import { QK } from '../../constants/query-keys';
import { AddAdjustmentLineForm } from './AddAdjustmentLineForm';

type PendingAdjustmentRow = {
  key: string;
  body: AddAdjustmentLineInput;
  sku: string;
  productName: string;
  locationPath: string;
  lotLabel?: string;
};

export function NewAdjustmentModal({
  open,
  warehouseId,
  onClose,
}: {
  open: boolean;
  warehouseId: string;
  onClose: () => void;
}) {
  const isArabic =
    typeof window !== 'undefined' &&
    (window.localStorage.getItem('wms-ui-language') === 'AR' || document.documentElement.dir === 'rtl');
  const t = (en: string, ar: string) => (isArabic ? ar : en);
  const qc = useQueryClient();
  const toast = useToast();

  const [step, setStep] = useState<1 | 2>(1);
  const [newCompanyId, setNewCompanyId] = useState('');
  const [newReason, setNewReason] = useState('');
  const [pendingRows, setPendingRows] = useState<PendingAdjustmentRow[]>([]);
  const [isClientComboboxActive, setIsClientComboboxActive] = useState(false);
  const clientComboboxWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      setStep(1);
      setNewCompanyId('');
      setNewReason('');
      setPendingRows([]);
    }
  }, [open]);

  useEffect(() => {
    setPendingRows([]);
  }, [newCompanyId]);

  const companies = useQuery({
    queryKey: QK.companies,
    queryFn: () => CompaniesApi.list(),
    enabled: open,
    staleTime: 10 * 60_000,
  });

  const composeSaveMut = useMutation({
    mutationFn: async () => {
      const companyId = newCompanyId.trim();
      const reason = newReason.trim();
      if (!warehouseId || !companyId || !reason) {
        throw new Error(t('Select client and enter a reason.', 'اختر العميل وأدخل السبب.'));
      }
      if (pendingRows.length === 0) {
        throw new Error(
          t('Add at least one product line before saving.', 'أضف بنداً واحداً على الأقل قبل الحفظ.'),
        );
      }
      const created = await AdjustmentsApi.create({ warehouseId, companyId, reason });
      let last = created;
      for (const row of pendingRows) {
        last = await AdjustmentsApi.addLine(created.id, row.body);
      }
      return last;
    },
    onSuccess: (last) => {
      toast.success(t('Draft saved.', 'تم حفظ المسودة.'));
      qc.invalidateQueries({ queryKey: QK.adjustments });
      qc.invalidateQueries({ queryKey: [...QK.adjustments, last.id] });
      qc.invalidateQueries({ queryKey: QK.inventoryStock });
      qc.invalidateQueries({ queryKey: QK.inventoryStockByProduct });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const composeConfirmMut = useMutation({
    mutationFn: async () => {
      const companyId = newCompanyId.trim();
      const reason = newReason.trim();
      if (!warehouseId || !companyId || !reason) {
        throw new Error(t('Select client and enter a reason.', 'اختر العميل وأدخل السبب.'));
      }
      if (pendingRows.length === 0) {
        throw new Error(
          t('Add at least one product line before confirming.', 'أضف بنداً واحداً على الأقل قبل التأكيد.'),
        );
      }
      const created = await AdjustmentsApi.create({ warehouseId, companyId, reason });
      let last = created;
      for (const row of pendingRows) {
        last = await AdjustmentsApi.addLine(created.id, row.body);
      }
      return AdjustmentsApi.approve(last.id);
    },
    onSuccess: () => {
      toast.success(t('Adjustment confirmed; stock updated.', 'تم تأكيد التعديل وتحديث المخزون.'));
      qc.invalidateQueries({ queryKey: QK.adjustments });
      qc.invalidateQueries({ queryKey: QK.inventoryStock });
      qc.invalidateQueries({ queryKey: QK.inventoryStockByProduct });
      qc.invalidateQueries({ queryKey: QK.ledger });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pending = composeSaveMut.isPending || composeConfirmMut.isPending;
  const canGoNext = !!warehouseId && !!newCompanyId.trim() && !!newReason.trim();

  const pendingCols: Column<PendingAdjustmentRow>[] = useMemo(
    () => [
      {
        header: t('SKU', 'SKU'),
        accessor: (r) => <span className="font-mono text-xs">{r.sku}</span>,
        width: '120px',
      },
      { header: t('Product', 'المنتج'), accessor: (r) => r.productName, width: '180px' },
      { header: t('Location', 'الموقع'), accessor: (r) => r.locationPath, width: '200px' },
      {
        header: t('Lot', 'الدفعة'),
        accessor: (r) =>
          r.lotLabel ? <span className="font-mono text-xs">{r.lotLabel}</span> : '—',
        width: '100px',
      },
      {
        header: t('Before → After', 'قبل → بعد'),
        accessor: (r) => (
          <span className="font-mono text-xs">
            — →{' '}
            {Number(r.body.quantityAfter).toLocaleString(undefined, { maximumFractionDigits: 4 })}
          </span>
        ),
        width: '140px',
      },
      {
        header: '',
        accessor: (r) => (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={pending}
            onClick={() => setPendingRows((rows) => rows.filter((x) => x.key !== r.key))}
          >
            {t('Remove', 'إزالة')}
          </Button>
        ),
        width: '100px',
      },
    ],
    [pending, isArabic],
  );

  const footer =
    step === 1 ? (
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>
          {t('Cancel', 'إلغاء')}
        </Button>
        <Button
          type="button"
          variant="secondary"
          className={ADJUSTMENT_PRIMARY_BUTTON_CLASS}
          disabled={!canGoNext || pending}
          onClick={() => setStep(2)}
        >
          {t('Next', 'التالي')}
        </Button>
      </div>
    ) : (
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="secondary" onClick={() => setStep(1)} disabled={pending}>
          {t('Back', 'رجوع')}
        </Button>
        <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>
          {t('Cancel', 'إلغاء')}
        </Button>
        <Button
          type="button"
          variant="secondary"
          loading={composeSaveMut.isPending}
          disabled={pending || pendingRows.length === 0}
          onClick={() => composeSaveMut.mutate()}
        >
          {t('Save draft', 'حفظ المسودة')}
        </Button>
        <Button
          type="button"
          variant="secondary"
          className={ADJUSTMENT_PRIMARY_BUTTON_CLASS}
          loading={composeConfirmMut.isPending}
          disabled={pending || pendingRows.length === 0}
          onClick={() => composeConfirmMut.mutate()}
        >
          {t('Confirm', 'تأكيد')}
        </Button>
      </div>
    );

  return (
    <Modal
      open={open}
      onClose={() => !pending && onClose()}
      title={
        step === 1
          ? t('New adjustment — details', 'تعديل جديد — التفاصيل')
          : t('New adjustment — lines', 'تعديل جديد — البنود')
      }
      widthClass="max-w-3xl"
      footer={footer}
    >
      {step === 1 ? (
        <div
          className={`space-y-4 text-sm ${
            isClientComboboxActive ? 'overflow-visible' : 'max-h-[calc(100vh-220px)] overflow-y-auto'
          } pr-1`}
        >
          {!warehouseId ? (
            <p className="text-sm text-rose-600">
              {t(
                'Cannot create — default warehouse not resolved.',
                'لا يمكن الإنشاء — المستودع الافتراضي غير محدد.',
              )}
            </p>
          ) : null}
          <div
            ref={clientComboboxWrapRef}
            onFocusCapture={() => setIsClientComboboxActive(true)}
            onBlurCapture={() => {
              window.setTimeout(() => {
                if (!clientComboboxWrapRef.current?.contains(document.activeElement)) {
                  setIsClientComboboxActive(false);
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
              options={(companies.data ?? []).map((c) => ({
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
        </div>
      ) : (
        <div className="max-h-[calc(100vh-220px)] space-y-4 overflow-y-auto pr-1 text-sm">
          {newCompanyId.trim() ? (
            <AddAdjustmentLineForm
              scope={{ warehouseId, companyId: newCompanyId.trim() }}
              loading={false}
              onAdd={(payload) =>
                setPendingRows((rows) => [
                  ...rows,
                  {
                    key: crypto.randomUUID(),
                    body: payload.body,
                    sku: payload.display.sku,
                    productName: payload.display.productName,
                    locationPath: payload.display.locationPath,
                    lotLabel: payload.display.lotLabel,
                  },
                ])
              }
            />
          ) : null}
          <DataTable
            title={t('Lines', 'البنود')}
            columns={pendingCols}
            rows={pendingRows}
            rowKey={(r) => r.key}
            empty={t('No lines yet — add products above.', 'لا توجد بنود بعد — أضف المنتجات بالأعلى.')}
            labels={{
              rowsSuffix: t('rows', 'صف'),
              resultsSuffix: t('results', 'نتيجة'),
              ofWord: t('of', 'من'),
              previous: t('Previous', 'السابق'),
              next: t('Next', 'التالي'),
              rowsPerPageAria: t('Rows per page', 'عدد الصفوف لكل صفحة'),
            }}
          />
        </div>
      )}
    </Modal>
  );
}
