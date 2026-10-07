import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { formatDateTime, useUiPreferences } from '@emdad/core'
import {
  ConfirmDialog,
  DataTable,
  EmptyState,
  FilterBar,
  PageHeader,
  ResetFiltersButton,
  SearchInput,
} from '@emdad/ui'
import { Alert, AlertDescription, AlertTitle } from '@emdad/ui/ui/alert'
import { Badge } from '@emdad/ui/ui/badge'
import { Button } from '@emdad/ui/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@emdad/ui/ui/dialog'
import { Input } from '@emdad/ui/ui/input'
import { Label } from '@emdad/ui/ui/label'
import { toast } from 'sonner'
import { FormsApi, type LeadFormSubmission } from '@/api/forms'
import { useAuth } from '@/auth/AuthContext'
import { QK } from '@/constants/query-keys'
import { useFilters } from '@/hooks/useFilters'
import { TASK_LIST_DEFAULT_PAGE_SIZE, useServerPagination } from '@/hooks/useServerPagination'

type FormsFilterDraft = {
  search: string
  createdFrom: string
  createdTo: string
}

export function FormsPage() {
  const { isArabic, locale } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const { user } = useAuth()
  const qc = useQueryClient()
  const canDelete = user?.role === 'super_admin'

  const [detail, setDetail] = useState<LeadFormSubmission | null>(null)
  const [toDelete, setToDelete] = useState<LeadFormSubmission | null>(null)

  const initialFilters = useMemo<FormsFilterDraft>(
    () => ({ search: '', createdFrom: '', createdTo: '' }),
    [],
  )

  const { draftFilters, appliedFilters, setDraft, applyFilters, resetFilters } =
    useFilters(initialFilters)

  const listParams = useMemo(
    () => ({
      search: appliedFilters.search.trim() || undefined,
      createdFrom: appliedFilters.createdFrom || undefined,
      createdTo: appliedFilters.createdTo || undefined,
    }),
    [appliedFilters],
  )

  const pagination = useServerPagination<LeadFormSubmission>({
    filterKey: listParams,
    queryKey: QK.forms.list(listParams),
    fetchPage: (offset, limit) => FormsApi.list({ ...listParams, offset, limit }),
    defaultPageSize: TASK_LIST_DEFAULT_PAGE_SIZE,
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => FormsApi.remove(id),
    onSuccess: () => {
      toast.success(t('Submission deleted.', 'تم حذف النموذج.'))
      qc.invalidateQueries({ queryKey: QK.forms.all, exact: false })
      setToDelete(null)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const columns = useMemo<ColumnDef<LeadFormSubmission>[]>(() => {
    const cols: ColumnDef<LeadFormSubmission>[] = [
      {
        id: 'name',
        header: t('Full name', 'الاسم الكامل'),
        cell: ({ row }) => (
          <span className="text-sm font-semibold">{row.original.fullName || '—'}</span>
        ),
      },
      {
        id: 'phone',
        header: t('Phone', 'الهاتف'),
        cell: ({ row }) => (
          <span className="font-mono text-xs" dir="ltr">
            {row.original.phone || '—'}
          </span>
        ),
      },
      {
        id: 'email',
        header: t('Email', 'البريد الإلكتروني'),
        cell: ({ row }) => (
          <span className="text-xs" dir="ltr">
            {row.original.email || '—'}
          </span>
        ),
      },
      {
        id: 'activity',
        header: t('Activity type', 'نوع النشاط'),
        cell: ({ row }) => (
          <Badge variant="outline" className="bg-amber-50 text-amber-900">
            {row.original.activityType}
          </Badge>
        ),
      },
      {
        id: 'message',
        header: t('Message', 'الرسالة'),
        cell: ({ row }) => (
          <span className="block max-w-64 truncate text-xs" title={row.original.message ?? ''}>
            {row.original.message?.trim() || '—'}
          </span>
        ),
      },
      {
        id: 'created',
        header: t('Submitted at', 'تاريخ الإرسال'),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {row.original.createdAt ? formatDateTime(row.original.createdAt, locale) : '—'}
          </span>
        ),
      },
    ]

    if (canDelete) {
      cols.push({
        id: 'delete',
        header: '',
        cell: ({ row }) => (
          <Button
            size="sm"
            variant="destructive"
            onClick={(e) => {
              e.stopPropagation()
              setToDelete(row.original)
            }}
          >
            {t('Delete', 'حذف')}
          </Button>
        ),
      })
    }

    return cols
  }, [canDelete, isArabic, locale]) // eslint-disable-line react-hooks/exhaustive-deps

  const activeCount = [appliedFilters.search, appliedFilters.createdFrom, appliedFilters.createdTo].filter((v) =>
    String(v).trim(),
  ).length

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('Forms', 'النماذج')}
        description={t(
          'Form submissions captured from landing pages.',
          'النماذج المُرسلة من صفحات الهبوط.',
        )}
      />

      <FilterBar>
        <SearchInput
          value={draftFilters.search}
          onChange={(v) => setDraft({ search: v })}
          placeholder={t(
            'Name, phone, email, or activity type',
            'الاسم أو الهاتف أو البريد أو نوع النشاط',
          )}
          className="max-w-md"
        />
        <Button type="button" onClick={applyFilters} disabled={pagination.isFetching}>
          {t('Apply filters', 'تطبيق الفلاتر')}
        </Button>
        {activeCount > 0 ? (
          <ResetFiltersButton onClick={resetFilters} label={t('Reset filters', 'إعادة تعيين الفلاتر')} />
        ) : null}
      </FilterBar>

      <div className="grid gap-4 sm:grid-cols-2 max-w-xl">
        <div className="space-y-2">
          <Label>{t('From date', 'من تاريخ')}</Label>
          <Input
            type="date"
            value={draftFilters.createdFrom}
            onChange={(e) => setDraft({ createdFrom: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>{t('To date', 'إلى تاريخ')}</Label>
          <Input
            type="date"
            value={draftFilters.createdTo}
            onChange={(e) => setDraft({ createdTo: e.target.value })}
          />
        </div>
      </div>

      {pagination.isError ? (
        <Alert variant="destructive">
          <AlertTitle>{t('Failed to load submissions', 'فشل تحميل النماذج')}</AlertTitle>
          <AlertDescription>
            <Button variant="link" className="h-auto p-0" onClick={() => pagination.refetch()}>
              {t('Retry', 'إعادة المحاولة')}
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <DataTable
        columns={columns}
        data={pagination.rows}
        getRowId={(r) => r.id}
        loading={pagination.isInitialLoading}
        empty={
          <EmptyState title={t('No submissions match the filters.', 'لا توجد نماذج مطابقة للفلاتر.')} />
        }
        onRowClick={setDetail}
        pagination={{
          page: pagination.page,
          pageSize: pagination.pageSize,
          total: pagination.total,
          onPageChange: pagination.serverPagination.onPageChange,
          onPageSizeChange: pagination.serverPagination.onPageSizeChange,
        }}
      />

      <Dialog open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('Submission details', 'تفاصيل النموذج')}</DialogTitle>
          </DialogHeader>
          {detail ? (
            <dl className="space-y-4 text-sm">
              <DetailRow label={t('Full name', 'الاسم الكامل')} value={detail.fullName} />
              <DetailRow label={t('Phone', 'الهاتف')} value={detail.phone} ltr />
              <DetailRow label={t('Email', 'البريد الإلكتروني')} value={detail.email} ltr />
              <DetailRow label={t('Activity type', 'نوع النشاط')} value={detail.activityType} />
              <DetailRow label={t('Message', 'الرسالة')} value={detail.message?.trim() || '—'} />
              <DetailRow
                label={t('Submitted at', 'تاريخ الإرسال')}
                value={detail.createdAt ? formatDateTime(detail.createdAt, locale) : '—'}
              />
            </dl>
          ) : null}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!toDelete}
        title={t('Delete submission', 'حذف النموذج')}
        description={
          toDelete
            ? `${t('Permanently delete the submission from', 'حذف النموذج نهائياً من')} ${toDelete.fullName}?`
            : ''
        }
        confirmLabel={t('Delete', 'حذف')}
        cancelLabel={t('Cancel', 'إلغاء')}
        intent="danger"
        loading={deleteMut.isPending}
        onConfirm={() => {
          if (toDelete) deleteMut.mutate(toDelete.id)
        }}
        onOpenChange={(v) => !v && !deleteMut.isPending && setToDelete(null)}
      />
    </div>
  )
}

function DetailRow({ label, value, ltr }: { label: string; value: string; ltr?: boolean }) {
  return (
    <div className="border-b pb-3">
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 whitespace-pre-wrap text-base" dir={ltr ? 'ltr' : undefined}>
        {value}
      </dd>
    </div>
  )
}
