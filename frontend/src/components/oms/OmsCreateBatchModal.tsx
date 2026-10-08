import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';

import { OmsApi, type OmsOrderListItem } from '../../api/oms';
import { QK } from '../../constants/query-keys';
import { useToast } from '../ToastProvider';
import { Modal } from '../Modal';

const ISSUE = new Set(['failed_delivery', 'cancelled', 'rejected', 'returned']);
const FINISHED = new Set(['delivered', 'completed']);

type Props = {
  open: boolean;
  selectedIds: string[];
  loadedOrders: OmsOrderListItem[];
  isArabic: boolean;
  onClose: () => void;
};

export function OmsCreateBatchModal({ open, selectedIds, loadedOrders, isArabic, onClose }: Props) {
  const navigate = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const loaded = useMemo(
    () => loadedOrders.filter((order) => selectedIds.includes(order.id)),
    [loadedOrders, selectedIds],
  );
  const canPreview = loaded.length === selectedIds.length && selectedIds.length > 0;
  const issues = loaded.filter((order) => ISSUE.has(order.status)).length;
  const finished = loaded.filter((order) => FINISHED.has(order.status)).length;
  const eligible = Math.max(0, loaded.length - issues - finished);

  async function create() {
    if (!selectedIds.length || saving) return;
    setSaving(true);
    try {
      const batch = await OmsApi.createBatch(selectedIds, name.trim());
      toast.success(
        isArabic
          ? `تم إنشاء ${batch.batchNumber}. ستُفتح صفحة المجموعة الآن.`
          : `${batch.batchNumber} created. Opening the batch workspace.`,
      );
      void qc.invalidateQueries({ queryKey: QK.omsBatches });
      onClose();
      setName('');
      navigate(`/oms/batches/${batch.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not create the batch.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isArabic ? 'إنشاء مجموعة' : 'Create batch'}
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
            disabled={saving || selectedIds.length === 0}
            onClick={() => void create()}
            className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? (isArabic ? 'جارٍ الإنشاء…' : 'Creating…') : isArabic ? 'إنشاء المجموعة' : 'Create batch'}
          </button>
        </div>
      }
    >
      <p className="text-sm text-text-muted">
        {isArabic
          ? 'تُحفظ الطلبات المحددة كمجموعة تشغيلية. تبقى حالات كل طلب كما هي، ويمكنك متابعة نفس المجموعة بعد تغيير المرحلة دون البحث عنها مرة أخرى.'
          : 'The selected orders are saved as an operational group. Each order keeps its own status, and you can continue this same group after the stage changes.'}
      </p>
      <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3">
        <div className="text-lg font-bold text-emerald-900">
          {isArabic ? `${selectedIds.length} طلب محدد` : `${selectedIds.length} orders selected`}
        </div>
        <div className="text-sm text-emerald-800">
          {isArabic ? 'ستُضاف هذه الطلبات إلى المجموعة الجديدة.' : 'These orders will belong to the new batch.'}
        </div>
      </div>
      {canPreview ? (
        <div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
          <Stat label={isArabic ? 'قابلة للمتابعة' : 'Eligible'} value={eligible} />
          <Stat label={isArabic ? 'فيها مشكلة' : 'With issues'} value={issues} />
          <Stat label={isArabic ? 'مكتملة' : 'Already finished'} value={finished} />
        </div>
      ) : (
        <p className="mt-3 text-sm text-text-muted">
          {isArabic
            ? 'بعض الطلبات المحددة موجودة في صفحات أخرى. سيتم حساب التفصيل بعد فتح المجموعة.'
            : 'Some selected orders are on other pages. The breakdown appears after the batch opens.'}
        </p>
      )}
      <label className="mt-4 block text-sm font-semibold">
        {isArabic ? 'اسم المجموعة (اختياري)' : 'Batch name (optional)'}
        <input
          value={name}
          maxLength={120}
          onChange={(event) => setName(event.target.value)}
          className="mt-1 w-full rounded-lg border border-border-subtle px-3 py-2 text-sm font-normal"
          placeholder={isArabic ? 'مثال: وردية الصباح' : 'Example: Morning shift'}
        />
      </label>
    </Modal>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border-subtle bg-surface px-2 py-2">
      <div className="text-lg font-bold">{value}</div>
      <div className="text-xs text-text-muted">{label}</div>
    </div>
  );
}
