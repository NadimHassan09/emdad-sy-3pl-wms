import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { OmsApi } from '../../api/oms';
import { QK } from '../../constants/query-keys';
import { useToast } from '../ToastProvider';
import { Modal } from '../Modal';

const MAX_IDS_PER_OPERATION = 1000;

type Props = {
  open: boolean;
  selectedIds: string[];
  isArabic: boolean;
  onClose: () => void;
  /** Called after orders were added (before navigation). */
  onAdded?: () => void;
};

export function OmsAddToBatchModal({ open, selectedIds, isArabic, onClose, onAdded }: Props) {
  const navigate = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [batchId, setBatchId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (!open) {
      setSearch('');
      setDebouncedSearch('');
      setBatchId(null);
    }
  }, [open]);

  const batchesQuery = useQuery({
    queryKey: [...QK.omsBatches, 'add-modal', debouncedSearch],
    queryFn: () => OmsApi.listBatches(debouncedSearch || undefined),
    enabled: open,
  });

  const batches = batchesQuery.data ?? [];

  async function confirm() {
    if (!batchId || !selectedIds.length || saving) return;
    if (selectedIds.length > MAX_IDS_PER_OPERATION) {
      toast.error(
        isArabic
          ? 'يمكن إضافة حتى 1000 طلب في المرة الواحدة.'
          : 'You can add up to 1000 orders at once.',
      );
      return;
    }
    setSaving(true);
    try {
      await OmsApi.addBatchOrders(batchId, selectedIds);
      const batch = batches.find((b) => b.id === batchId);
      toast.success(
        isArabic
          ? `تمت إضافة ${selectedIds.length} طلب إلى ${batch?.batchNumber ?? 'المجموعة'}.`
          : `Added ${selectedIds.length} orders to ${batch?.batchNumber ?? 'the batch'}.`,
      );
      void qc.invalidateQueries({ queryKey: QK.omsBatches });
      onAdded?.();
      onClose();
      navigate(`/oms/batches/${batchId}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not add orders to the batch.');
    } finally {
      setSaving(false);
    }
  }

  const overLimit = selectedIds.length > MAX_IDS_PER_OPERATION;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isArabic ? 'إضافة إلى مجموعة موجودة' : 'Add to existing batch'}
      widthClass="max-w-xl"
      footer={
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border-subtle px-4 py-2 text-sm font-semibold"
          >
            {isArabic ? 'إلغاء' : 'Cancel'}
          </button>
          <button
            type="button"
            disabled={saving || !batchId || selectedIds.length === 0}
            onClick={() => void confirm()}
            className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving
              ? isArabic
                ? 'جارٍ الإضافة…'
                : 'Adding…'
              : isArabic
                ? 'إضافة إلى المجموعة'
                : 'Add to batch'}
          </button>
        </div>
      }
    >
      <p className="text-sm text-text-muted">
        {isArabic
          ? 'اختر مجموعة موجودة لإضافة الطلبات المحددة إليها. الطلبات الموجودة فيها مسبقًا لن تتكرر.'
          : 'Pick an existing batch to add the selected orders to. Orders already in the batch are not duplicated.'}
      </p>
      <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3">
        <div className="text-lg font-bold text-emerald-900">
          {isArabic ? `${selectedIds.length} طلب محدد` : `${selectedIds.length} orders selected`}
        </div>
        {overLimit ? (
          <div className="text-sm font-semibold text-rose-700">
            {isArabic
              ? 'يمكن إضافة حتى 1000 طلب في المرة الواحدة.'
              : 'You can add up to 1000 orders at once.'}
          </div>
        ) : null}
      </div>
      <label className="mt-4 block text-sm font-semibold">
        {isArabic ? 'بحث عن مجموعة' : 'Search batches'}
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="mt-1 w-full rounded-lg border border-border-subtle px-3 py-2 text-sm font-normal"
          placeholder={isArabic ? 'رقم المجموعة أو الاسم…' : 'Batch number or name…'}
        />
      </label>
      <div className="mt-3 max-h-72 overflow-y-auto rounded-lg border border-border-subtle">
        {batchesQuery.isLoading ? (
          <div className="px-3 py-4 text-sm text-text-muted">{isArabic ? 'جارٍ التحميل…' : 'Loading…'}</div>
        ) : batchesQuery.isError ? (
          <div className="px-3 py-4 text-sm text-rose-700">
            {batchesQuery.error instanceof Error
              ? batchesQuery.error.message
              : isArabic
                ? 'تعذر تحميل المجموعات.'
                : 'Could not load batches.'}
          </div>
        ) : batches.length === 0 ? (
          <div className="px-3 py-4 text-sm text-text-muted">
            {isArabic ? 'لا توجد مجموعات.' : 'No batches found.'}
          </div>
        ) : (
          <ul className="divide-y divide-border-subtle">
            {batches.map((batch) => {
              const selected = batch.id === batchId;
              return (
                <li key={batch.id}>
                  <button
                    type="button"
                    onClick={() => setBatchId(batch.id)}
                    className={`flex w-full items-center justify-between gap-3 px-3 py-2.5 text-start text-sm transition-colors ${
                      selected ? 'bg-emerald-50 dark:bg-emerald-950/30' : 'hover:bg-surface-hover'
                    }`}
                    aria-pressed={selected}
                  >
                    <span className="min-w-0">
                      <span className="block font-semibold">{batch.batchNumber}</span>
                      <span className="block truncate text-xs text-text-muted">
                        {batch.name || (isArabic ? 'بدون اسم' : 'Unnamed')} ·{' '}
                        {new Date(batch.createdAt).toLocaleDateString()}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="text-xs text-text-muted">
                        {isArabic ? `${batch.orderCount} طلب` : `${batch.orderCount} orders`}
                      </span>
                      {selected ? (
                        <i className="fa-solid fa-circle-check text-emerald-700" aria-hidden="true" />
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Modal>
  );
}
