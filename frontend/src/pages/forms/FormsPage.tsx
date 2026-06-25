import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Alert } from '@ds';
import { FormsApi, type LeadFormSubmission } from '../../api/forms';
import { Button } from '../../components/Button';
import { ConfirmModal } from '../../components/ConfirmModal';
import { Column, DataTable } from '../../components/DataTable';
import { FilterPanel } from '../../components/FilterPanel';
import { Modal } from '../../components/Modal';
import { SelectField } from '../../components/SelectField';
import { TextField } from '../../components/TextField';
import { useToast } from '../../components/ToastProvider';
import { QK } from '../../constants/query-keys';
import { useAuth } from '../../auth/AuthContext';
import { useFilters } from '../../hooks/useFilters';
import {
  TASK_LIST_DEFAULT_PAGE_SIZE,
  useServerPagination,
} from '../../hooks/useServerPagination';
import { useWmsTranslation } from '../../lib/ui-i18n';

type FormsFilters = {
  search: string;
  activityType: string;
  createdFrom: string;
  createdTo: string;
};

function formatDateTime(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

export function FormsPage() {
  const { t } = useWmsTranslation();
  const { user } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const canDelete = user?.role === 'super_admin';

  const [detail, setDetail] = useState<LeadFormSubmission | null>(null);
  const [toDelete, setToDelete] = useState<LeadFormSubmission | null>(null);

  const initial = useMemo<FormsFilters>(
    () => ({ search: '', activityType: '', createdFrom: '', createdTo: '' }),
    [],
  );
  const { draftFilters, appliedFilters, setDraft, applyFilters, resetFilters } =
    useFilters(initial);

  const activityTypesQuery = useQuery({
    queryKey: QK.forms.activityTypes,
    queryFn: () => FormsApi.activityTypes(),
    staleTime: 5 * 60_000,
  });

  const listParams = useMemo(
    () => ({
      search: appliedFilters.search.trim() || undefined,
      activityType: appliedFilters.activityType || undefined,
      createdFrom: appliedFilters.createdFrom || undefined,
      createdTo: appliedFilters.createdTo || undefined,
    }),
    [appliedFilters],
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

  const activityTypeOptions = useMemo(
    () => [
      { value: '', label: t(['All activity types', 'كل أنواع النشاط']) },
      ...(activityTypesQuery.data ?? []).map((a) => ({ value: a, label: a })),
    ],
    [activityTypesQuery.data, t],
  );

  const columns: Column<LeadFormSubmission>[] = [
    {
      header: t(['Full name', 'الاسم الكامل']),
      accessor: (r) => <span className="font-medium text-slate-900">{r.fullName}</span>,
      width: '170px',
    },
    {
      header: t(['Phone', 'الهاتف']),
      accessor: (r) => <span className="font-mono text-xs" dir="ltr">{r.phone}</span>,
      width: '140px',
    },
    {
      header: t(['Email', 'البريد الإلكتروني']),
      accessor: (r) => <span className="text-xs" dir="ltr">{r.email}</span>,
      width: '200px',
    },
    {
      header: t(['Activity type', 'نوع النشاط']),
      accessor: (r) => (
        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
          {r.activityType}
        </span>
      ),
      width: '150px',
    },
    {
      header: t(['Message', 'الرسالة']),
      accessor: (r) => (
        <span className="block max-w-[260px] truncate text-xs text-slate-600" title={r.message ?? ''}>
          {r.message?.trim() || '—'}
        </span>
      ),
    },
    {
      header: t(['Submitted at', 'تاريخ الإرسال']),
      accessor: (r) => <span className="text-xs text-slate-600">{formatDateTime(r.createdAt)}</span>,
      width: '170px',
    },
    {
      header: t(['Actions', 'إجراءات']),
      accessor: (r) => (
        <div className="flex flex-wrap gap-1">
          <Button size="sm" variant="secondary" onClick={() => setDetail(r)}>
            {t(['View', 'عرض'])}
          </Button>
          {canDelete ? (
            <Button size="sm" variant="danger" onClick={() => setToDelete(r)}>
              {t(['Delete', 'حذف'])}
            </Button>
          ) : null}
        </div>
      ),
      width: '160px',
    },
  ];

  return (
    <div>
      <FilterPanel
        title={t(['Lead filters', 'فلاتر العملاء المحتملين'])}
        onApply={applyFilters}
        onReset={resetFilters}
        loading={pagination.isFetching}
        applyLabel={t(['Apply filters', 'تطبيق الفلاتر'])}
        resetLabel={t(['Reset filters', 'إعادة تعيين الفلاتر'])}
        className="mb-4"
      >
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
          <TextField
            label={t(['Search', 'بحث'])}
            value={draftFilters.search}
            onChange={(e) => setDraft({ search: e.target.value })}
            placeholder={t(['Name, phone, or email', 'الاسم أو الهاتف أو البريد'])}
          />
          <SelectField
            label={t(['Activity type', 'نوع النشاط'])}
            value={draftFilters.activityType}
            onChange={(e) => setDraft({ activityType: e.target.value })}
            options={activityTypeOptions}
          />
          <TextField
            label={t(['From date', 'من تاريخ'])}
            type="date"
            value={draftFilters.createdFrom}
            onChange={(e) => setDraft({ createdFrom: e.target.value })}
          />
          <TextField
            label={t(['To date', 'إلى تاريخ'])}
            type="date"
            value={draftFilters.createdTo}
            onChange={(e) => setDraft({ createdTo: e.target.value })}
          />
        </div>
      </FilterPanel>

      <DataTable
        title={t(['Lead submissions', 'نماذج العملاء المحتملين'])}
        description={t([
          'Form submissions captured from landing pages.',
          'النماذج المُرسلة من صفحات الهبوط.',
        ])}
        columns={columns}
        rows={pagination.rows}
        rowKey={(r) => r.id}
        loading={pagination.isInitialLoading}
        onRowClick={(r) => setDetail(r)}
        serverPagination={pagination.serverPagination}
        empty={t(['No submissions match the filters.', 'لا توجد نماذج مطابقة للفلاتر.'])}
      />

      {pagination.isError ? (
        <Alert
          variant="error"
          title={t(['Failed to load submissions', 'فشل تحميل النماذج'])}
          description={t([
            'There was a problem retrieving lead submissions. Check your connection and try again.',
            'حدثت مشكلة في جلب النماذج. تحقق من اتصالك وأعد المحاولة.',
          ])}
          className="mt-3"
        >
          <Alert.Action onClick={() => pagination.refetch()}>
            {t(['Retry', 'إعادة المحاولة'])}
          </Alert.Action>
        </Alert>
      ) : null}

      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title={t(['Submission details', 'تفاصيل النموذج'])}
      >
        {detail ? (
          <dl className="space-y-3 text-sm">
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
    </div>
  );
}

function DetailRow({ label, value, ltr }: { label: string; value: string; ltr?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-slate-100 pb-2">
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="whitespace-pre-wrap text-slate-800" dir={ltr ? 'ltr' : undefined}>
        {value}
      </dd>
    </div>
  );
}
