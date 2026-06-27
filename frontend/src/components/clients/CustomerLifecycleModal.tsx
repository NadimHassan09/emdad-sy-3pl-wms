import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { CompaniesApi, type CompanyListRow } from '../../api/companies';
import { QK } from '../../constants/query-keys';
import { Button } from '../Button';
import { Modal } from '../Modal';
import { StatusBadge } from '../StatusBadge';
import { useToast } from '../ToastProvider';

type LifecycleAction = 'suspend' | 'archive' | 'restore' | 'delete';

function t(isArabic: boolean, en: string, ar: string) {
  return isArabic ? ar : en;
}

export function CustomerLifecycleModal({
  company,
  isSuperAdmin,
  onClose,
}: {
  company: CompanyListRow | null;
  isSuperAdmin: boolean;
  onClose: () => void;
}) {
  const isArabic =
    typeof window !== 'undefined' &&
    (window.localStorage.getItem('wms-ui-language') === 'AR' ||
      document.documentElement.dir === 'rtl');
  const qc = useQueryClient();
  const toast = useToast();
  const [reason, setReason] = useState('');
  const id = company?.id ?? null;
  const open = !!company;

  useEffect(() => {
    if (open) setReason('');
  }, [open, id]);

  const lifecycleKey = [...QK.companies, id, 'lifecycle'] as const;
  const { data: ctx, isLoading } = useQuery({
    queryKey: lifecycleKey,
    queryFn: () => CompaniesApi.getLifecycle(id as string),
    enabled: open && !!id,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: QK.companies });
    qc.invalidateQueries({ queryKey: lifecycleKey });
  };

  const runMut = useMutation({
    mutationFn: async (action: LifecycleAction) => {
      if (!id) throw new Error('No company');
      const trimmed = reason.trim() || undefined;
      switch (action) {
        case 'suspend':
          return CompaniesApi.suspend(id, trimmed);
        case 'archive':
          return CompaniesApi.archive(id, trimmed);
        case 'restore':
          return CompaniesApi.restore(id, trimmed);
        case 'delete':
          // Empty customers are hard-deleted; customers with history are purged.
          if (ctx?.actions.canHardDelete) return CompaniesApi.remove(id);
          return CompaniesApi.purge(id);
      }
    },
    onSuccess: (_res, action) => {
      const msg =
        action === 'suspend'
          ? t(isArabic, 'Customer suspended.', 'تم إيقاف العميل.')
          : action === 'archive'
            ? t(isArabic, 'Customer archived.', 'تمت أرشفة العميل.')
            : action === 'restore'
              ? t(isArabic, 'Customer restored.', 'تمت استعادة العميل.')
              : t(isArabic, 'Customer permanently deleted.', 'تم حذف العميل نهائيا.');
      toast.success(msg);
      refresh();
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const busy = runMut.isPending;
  const a = ctx?.actions;

  const deleteEnabled = !!a && (a.canHardDelete || (a.canPurge && isSuperAdmin));
  const deleteTooltip = (() => {
    if (!ctx) return '';
    if (a?.canHardDelete) return t(isArabic, 'No related data — safe to delete.', 'لا توجد بيانات مرتبطة — حذف آمن.');
    if (!isSuperAdmin)
      return t(isArabic, 'Only a super administrator can permanently delete.', 'يمكن للمسؤول الأعلى فقط الحذف نهائيا.');
    if (ctx.blockers.purge.length) return ctx.blockers.purge.join(' ');
    return '';
  })();

  return (
    <Modal
      open={open}
      onClose={() => (busy ? undefined : onClose())}
      title={company ? `${t(isArabic, 'Lifecycle', 'دورة الحياة')} — ${company.name}` : ''}
      widthClass="max-w-2xl"
      footer={
        <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
          {t(isArabic, 'Close', 'إغلاق')}
        </Button>
      }
    >
      {isLoading || !ctx ? (
        <p className="py-6 text-center text-sm text-slate-500">
          {t(isArabic, 'Loading…', 'جارٍ التحميل…')}
        </p>
      ) : (
        <div className="space-y-5">
          <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
            <span className="text-sm font-medium text-slate-700">
              {t(isArabic, 'Current status', 'الحالة الحالية')}
            </span>
            <StatusBadge status={ctx.status} />
          </div>

          <div>
            <h4 className="mb-2 text-sm font-semibold text-slate-800">
              {t(isArabic, 'Account data', 'بيانات الحساب')}
            </h4>
            <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
              <Stat label={t(isArabic, 'Products', 'المنتجات')} value={ctx.counts.products} />
              <Stat
                label={t(isArabic, 'Inbound', 'الوارد')}
                value={`${ctx.counts.inboundOrders} (${ctx.counts.openInbound} ${t(isArabic, 'open', 'مفتوح')})`}
              />
              <Stat
                label={t(isArabic, 'Outbound', 'الصادر')}
                value={`${ctx.counts.outboundOrders} (${ctx.counts.openOutbound} ${t(isArabic, 'open', 'مفتوح')})`}
              />
              <Stat label={t(isArabic, 'On-hand stock', 'المخزون المتوفر')} value={ctx.counts.stockOnHand} />
              <Stat label={t(isArabic, 'Invoices', 'الفواتير')} value={ctx.counts.invoices} />
              <Stat label={t(isArabic, 'Active users', 'المستخدمون النشطون')} value={ctx.counts.activeUsers} />
            </div>
          </div>

          {ctx.status === 'archived' ? (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {t(isArabic, 'Archived', 'مؤرشف')}{' '}
              {ctx.retentionElapsedDays ?? 0}/{ctx.retentionDays} {t(isArabic, 'retention days elapsed', 'يوم من فترة الاحتفاظ')}
            </p>
          ) : null}

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              {t(isArabic, 'Reason (optional)', 'السبب (اختياري)')}
            </label>
            <textarea
              className="block w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
              rows={2}
              value={reason}
              disabled={busy}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t(isArabic, 'e.g. non-payment, contract terminated…', 'مثال: عدم السداد، إنهاء العقد…')}
            />
          </div>

          <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
            {a?.canSuspend ? (
              <Button type="button" variant="secondary" disabled={busy} onClick={() => runMut.mutate('suspend')}>
                {t(isArabic, 'Suspend', 'إيقاف مؤقت')}
              </Button>
            ) : null}
            {a?.canRestore ? (
              <Button type="button" variant="brand" disabled={busy} onClick={() => runMut.mutate('restore')}>
                {t(isArabic, 'Restore', 'استعادة')}
              </Button>
            ) : null}
            <ArchiveButton ctx={ctx} busy={busy} isArabic={isArabic} onArchive={() => runMut.mutate('archive')} />
            <span title={deleteTooltip} className="inline-flex">
              <Button
                type="button"
                variant="danger"
                disabled={busy || !deleteEnabled}
                onClick={() => {
                  if (
                    window.confirm(
                      t(
                        isArabic,
                        `Permanently delete "${ctx.name}"? This cannot be undone.`,
                        `حذف "${ctx.name}" نهائيا؟ لا يمكن التراجع عن هذا الإجراء.`,
                      ),
                    )
                  ) {
                    runMut.mutate('delete');
                  }
                }}
              >
                {t(isArabic, 'Permanently Delete', 'حذف نهائي')}
              </Button>
            </span>
          </div>
        </div>
      )}
    </Modal>
  );
}

function ArchiveButton({
  ctx,
  busy,
  isArabic,
  onArchive,
}: {
  ctx: NonNullable<Awaited<ReturnType<typeof CompaniesApi.getLifecycle>>>;
  busy: boolean;
  isArabic: boolean;
  onArchive: () => void;
}) {
  if (ctx.status === 'archived') return null;
  const tooltip = ctx.actions.canArchive ? '' : ctx.blockers.archive.join(' ');
  return (
    <span title={tooltip} className="inline-flex">
      <Button type="button" variant="secondary" disabled={busy || !ctx.actions.canArchive} onClick={onArchive}>
        {t(isArabic, 'Archive', 'أرشفة')}
      </Button>
    </span>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md border border-slate-100 bg-white px-3 py-2">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="font-mono text-sm font-semibold text-slate-800">{value}</p>
    </div>
  );
}
