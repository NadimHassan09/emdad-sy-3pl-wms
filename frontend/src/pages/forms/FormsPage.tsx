import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { Alert, Card, TableFooterPagination, useDebouncedValue } from '@ds';
import { FormsApi, type LeadFormSubmission } from '../../api/forms';
import { AdminListPageShell } from '../../components/AdminListPageShell';
import { Button } from '../../components/Button';
import { ConfirmModal } from '../../components/ConfirmModal';
import { Modal } from '../../components/Modal';
import { useToast } from '../../components/ToastProvider';
import { QK } from '../../constants/query-keys';
import { useAuth } from '../../auth/AuthContext';
import { useCachedState } from '../../hooks/useCachedState';
import {
  TASK_LIST_DEFAULT_PAGE_SIZE,
  useServerPagination,
} from '../../hooks/useServerPagination';
import { useWmsTranslation } from '../../lib/ui-i18n';

function formatDateTime(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

export function FormsPage() {
  const { t, isArabic } = useWmsTranslation();
  const { user } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const canDelete = user?.role === 'super_admin';

  const [detail, setDetail] = useState<LeadFormSubmission | null>(null);
  const [toDelete, setToDelete] = useState<LeadFormSubmission | null>(null);

  const [search, setSearch] = useCachedState('search', '');
  const [createdFrom, setCreatedFrom] = useCachedState('createdFrom', '');
  const [createdTo, setCreatedTo] = useCachedState('createdTo', '');
  const debouncedSearch = useDebouncedValue(search, 300);

  const listParams = useMemo(
    () => ({
      search: debouncedSearch.trim() || undefined,
      createdFrom: createdFrom || undefined,
      createdTo: createdTo || undefined,
    }),
    [debouncedSearch, createdFrom, createdTo],
  );

  const pagination = useServerPagination<LeadFormSubmission>({
    filterKey: listParams,
    queryKey: QK.forms.list(listParams),
    fetchPage: (offset, limit) => FormsApi.list({ ...listParams, offset, limit }),
    defaultPageSize: TASK_LIST_DEFAULT_PAGE_SIZE,
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => FormsApi.remove(id),
    onSuccess: () => {
      toast.success(t(['Submission deleted.', 'تم حذف النموذج.']));
      qc.invalidateQueries({ queryKey: QK.forms.all, exact: false });
      setToDelete(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const colCount = canDelete ? 7 : 6;

  return (
    <AdminListPageShell
      icon="fa-clipboard-list"
      title={t(['Forms', 'النماذج'])}
      subtitle={t([
        'Form submissions captured from landing pages.',
        'النماذج المُرسلة من صفحات الهبوط.',
      ])}
      isArabic={isArabic}
    >
      <Card className="mb-4">
        <div className="flex flex-col sm:flex-row gap-3 sm:flex-wrap sm:items-center">
          <div className="relative flex-1 max-w-sm">
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-text-faint text-xs" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t([
                'Name, phone, email, or activity type',
                'الاسم أو الهاتف أو البريد أو نوع النشاط',
              ])}
              className="w-full pl-9 pr-4 py-2 bg-surface-sunken border border-border-strong text-text-strong placeholder:text-text-faint rounded-lg text-sm input-premium"
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:flex-wrap">
            <input
              type="date"
              value={createdFrom}
              onChange={(e) => setCreatedFrom(e.target.value)}
              aria-label={t(['From date', 'من تاريخ'])}
              title={t(['From date', 'من تاريخ'])}
              className="px-3 py-2 bg-surface-sunken border border-border-strong rounded-lg text-sm text-text-body input-premium"
            />
            <input
              type="date"
              value={createdTo}
              onChange={(e) => setCreatedTo(e.target.value)}
              aria-label={t(['To date', 'إلى تاريخ'])}
              title={t(['To date', 'إلى تاريخ'])}
              className="px-3 py-2 bg-surface-sunken border border-border-strong rounded-lg text-sm text-text-body input-premium"
            />
          </div>
        </div>
      </Card>

      {pagination.isError ? (
        <Alert
          variant="error"
          title={t(['Failed to load submissions', 'فشل تحميل النماذج'])}
          description={t([
            'There was a problem retrieving lead submissions. Check your connection and try again.',
            'حدثت مشكلة في جلب النماذج. تحقق من اتصالك وأعد المحاولة.',
          ])}
          className="mb-4"
        >
          <Alert.Action onClick={() => pagination.refetch()}>
            {t(['Retry', 'إعادة المحاولة'])}
          </Alert.Action>
        </Alert>
      ) : null}

      <Card className="overflow-hidden" padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-card-muted text-xs uppercase text-text-muted font-semibold">
              <tr>
                <th className="px-5 py-3 text-left">{t(['Full name', 'الاسم الكامل'])}</th>
                <th className="px-5 py-3 text-left">{t(['Phone', 'الهاتف'])}</th>
                <th className="px-5 py-3 text-left">{t(['Email', 'البريد الإلكتروني'])}</th>
                <th className="px-5 py-3 text-left">{t(['Activity type', 'نوع النشاط'])}</th>
                <th className="px-5 py-3 text-left">{t(['Message', 'الرسالة'])}</th>
                <th className="px-5 py-3 text-right">{t(['Submitted at', 'تاريخ الإرسال'])}</th>
                {canDelete ? (
                  <th className="px-5 py-3 text-right">{t(['Actions', 'إجراءات'])}</th>
                ) : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {pagination.isInitialLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={`sk-${i}`} className="animate-pulse">
                    <td className="px-5 py-3.5" colSpan={colCount}>
                      <div className="h-4 w-full max-w-xl rounded bg-skeleton-base" />
                    </td>
                  </tr>
                ))
              ) : pagination.rows.length === 0 ? (
                <tr>
                  <td colSpan={colCount} className="px-5 py-10 text-center text-text-faint text-sm">
                    {t(['No submissions match the filters.', 'لا توجد نماذج مطابقة للفلاتر.'])}
                  </td>
                </tr>
              ) : (
                pagination.rows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => setDetail(row)}
                    className="hover:bg-surface-hover transition-colors group cursor-pointer"
                  >
                    <td className="px-5 py-3.5 font-semibold text-text-strong">
                      {row.fullName || '—'}
                    </td>
                    <td className="px-5 py-3.5 text-text-body font-mono text-xs" dir="ltr">
                      {row.phone || '—'}
                    </td>
                    <td className="px-5 py-3.5 text-text-body text-xs" dir="ltr">
                      {row.email || '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium text-text-strong"
                        style={{ backgroundColor: '#fff5e3' }}
                      >
                        {row.activityType}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-text-body">
                      <span
                        className="block max-w-[260px] truncate text-xs"
                        title={row.message ?? ''}
                      >
                        {row.message?.trim() || '—'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right text-text-muted text-xs">
                      {formatDateTime(row.createdAt)}
                    </td>
                    {canDelete ? (
                      <td
                        className="px-5 py-3.5 text-right"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        <Button size="sm" variant="danger" onClick={() => setToDelete(row)}>
                          {t(['Delete', 'حذف'])}
                        </Button>
                      </td>
                    ) : null}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <TableFooterPagination pagination={pagination.serverPagination} isArabic={isArabic} />
      </Card>

      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title={t(['Submission details', 'تفاصيل النموذج'])}
        widthClass="max-w-6xl w-full min-h-[70vh]"
      >
        {detail ? (
          <dl className="space-y-5 text-base">
            <DetailRow label={t(['Full name', 'الاسم الكامل'])} value={detail.fullName} />
            <DetailRow label={t(['Phone', 'الهاتف'])} value={detail.phone} ltr />
            <DetailRow label={t(['Email', 'البريد الإلكتروني'])} value={detail.email} ltr />
            <DetailRow label={t(['Activity type', 'نوع النشاط'])} value={detail.activityType} />
            <DetailRow
              label={t(['Message', 'الرسالة'])}
              value={detail.message?.trim() || '—'}
            />
            <DetailRow
              label={t(['Submitted at', 'تاريخ الإرسال'])}
              value={formatDateTime(detail.createdAt)}
            />
          </dl>
        ) : null}
      </Modal>

      <ConfirmModal
        open={!!toDelete}
        title={t(['Delete submission', 'حذف النموذج'])}
        confirmLabel={t(['Delete', 'حذف'])}
        cancelLabel={t(['Cancel', 'إلغاء'])}
        danger
        loading={deleteMut.isPending}
        onClose={() => !deleteMut.isPending && setToDelete(null)}
        onConfirm={() => toDelete && deleteMut.mutate(toDelete.id)}
      >
        {toDelete ? (
          <p>
            {t(['Permanently delete the submission from ', 'حذف النموذج نهائياً من '])}
            <span className="font-semibold">{toDelete.fullName}</span>
            {t([' ? This cannot be undone.', ' ؟ لا يمكن التراجع عن ذلك.'])}
          </p>
        ) : null}
      </ConfirmModal>
    </AdminListPageShell>
  );
}

function DetailRow({ label, value, ltr }: { label: string; value: string; ltr?: boolean }) {
  return (
    <div className="flex flex-col gap-1 border-b border-border-subtle pb-3">
      <dt className="text-sm font-semibold uppercase tracking-wide text-text-muted">{label}</dt>
      <dd className="whitespace-pre-wrap text-lg text-text-strong" dir={ltr ? 'ltr' : undefined}>
        {value}
      </dd>
    </div>
  );
}
