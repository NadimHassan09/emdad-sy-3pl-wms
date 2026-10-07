import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { formatDateTime, useUiPreferences } from '@emdad/core'
import {
  DataTable,
  EmptyState,
  FilterBar,
  PageHeader,
  ResetFiltersButton,
  SearchInput,
} from '@emdad/ui'
import { Alert, AlertDescription, AlertTitle } from '@emdad/ui/ui/alert'
import { Button } from '@emdad/ui/ui/button'
import { Combobox } from '@emdad/ui/ui/combobox'
import { Input } from '@emdad/ui/ui/input'
import { Label } from '@emdad/ui/ui/label'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@emdad/ui/ui/dropdown-menu'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@emdad/ui/ui/select'
import { MoreHorizontal } from 'lucide-react'
import { toast } from 'sonner'
import { CompaniesApi } from '@/api/companies'
import {
  DocumentsApi,
  type ContractCatalogRow,
  type ContractGenerationFilter,
  type DocumentLang,
  type DocumentReferenceType,
  type DocumentType,
} from '@/api/documents'
import { QK } from '@/constants/query-keys'
import { CHUNK_SIZE_STANDARD, useChunkedServerPagination } from '@/hooks/useChunkedServerPagination'
import { useFilters } from '@/hooks/useFilters'
import { companyFilterComboboxOptions } from '@/lib/company-filter-options'
import { ContractGenerationBadge } from './contracts-ui'
import { EditDocumentSlotDialog } from './EditDocumentSlotDialog'

export type ContractsRouteKind = 'grn' | 'dn'

function documentTypeForRoute(kind: ContractsRouteKind): DocumentType {
  return kind === 'grn' ? 'grn' : 'delivery_note'
}

function referenceTypeForRoute(kind: ContractsRouteKind): DocumentReferenceType {
  return kind === 'grn' ? 'inbound_order' : 'outbound_order'
}

function orderPath(row: ContractCatalogRow): string {
  return row.referenceType === 'inbound_order'
    ? `/orders/inbound/${row.referenceId}`
    : `/orders/outbound/${row.referenceId}`
}

function primaryDocumentNumber(row: ContractCatalogRow): string {
  return row.en?.documentNumber ?? row.ar?.documentNumber ?? ''
}

type ContractFilters = {
  search: string
  companyId: string
  language: string
  generationStatus: string
  createdFrom: string
  createdTo: string
}

export function ContractsCatalogPage({ kind }: { kind: ContractsRouteKind }) {
  const { isArabic, locale } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const queryClient = useQueryClient()
  const documentType = documentTypeForRoute(kind)
  const referenceType = referenceTypeForRoute(kind)

  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [editRow, setEditRow] = useState<ContractCatalogRow | null>(null)

  const initialFilters = useMemo<ContractFilters>(
    () => ({
      search: '',
      companyId: '',
      language: '',
      generationStatus: '',
      createdFrom: '',
      createdTo: '',
    }),
    [],
  )

  const { draftFilters, appliedFilters, setDraft, applyFilters, resetFilters } =
    useFilters(initialFilters)

  const listParams = useMemo(
    () => ({
      companyId: appliedFilters.companyId || undefined,
      search: appliedFilters.search.trim() || undefined,
      type: documentType,
      referenceType,
      language: (appliedFilters.language.trim() || undefined) as DocumentLang | undefined,
      generationStatus: (appliedFilters.generationStatus.trim() || undefined) as
        | ContractGenerationFilter
        | undefined,
      createdFrom: appliedFilters.createdFrom.trim() || undefined,
      createdTo: appliedFilters.createdTo.trim() || undefined,
    }),
    [appliedFilters, documentType, referenceType],
  )

  const queryKeyPrefix = kind === 'grn' ? QK.contractsGrn : QK.contractsDn

  const pagination = useChunkedServerPagination<ContractCatalogRow>({
    chunkSize: CHUNK_SIZE_STANDARD,
    filterKey: listParams,
    fetchChunk: (offset, limit) => DocumentsApi.listCatalog({ ...listParams, offset, limit }),
    rtQueryKeyPrefix: queryKeyPrefix,
    chunkQueryKeyPrefix: kind === 'grn' ? 'contracts-grn-chunk' : 'contracts-dn-chunk',
  })

  const companies = useQuery({
    queryKey: QK.companies,
    queryFn: () => CompaniesApi.list(),
    staleTime: 10 * 60_000,
  })

  const clientFilterOptions = useMemo(
    () => companyFilterComboboxOptions(companies.data, t('All clients', 'كل العملاء')),
    [companies.data, isArabic], // eslint-disable-line react-hooks/exhaustive-deps
  )

  const pageTitle =
    kind === 'grn'
      ? t('Goods receipt notes (GRN)', 'سندات استلام البضاعة (GRN)')
      : t('Delivery notes (DN)', 'سندات التسليم (DN)')

  const emptyMessage =
    kind === 'grn'
      ? t('No GRN slots match the filters.', 'لا توجد GRN مطابقة للفلاتر.')
      : t('No delivery note slots match the filters.', 'لا توجد سندات تسليم مطابقة للفلاتر.')

  async function handleLangAction(row: ContractCatalogRow, lang: DocumentLang) {
    const key = `${row.slotKey}:${lang}`
    setBusyKey(key)
    try {
      const slot = lang === 'en' ? row.en : row.ar
      if (slot) {
        await DocumentsApi.openInNewTab(slot.documentId)
        return
      }

      const created =
        row.type === 'grn'
          ? await DocumentsApi.generateGrn(row.taskId, lang)
          : await DocumentsApi.generateDn(row.taskId, lang)

      await queryClient.invalidateQueries({ queryKey: queryKeyPrefix })
      if (created?.id) await DocumentsApi.openInNewTab(created.id)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('Could not open PDF.', 'تعذر فتح PDF.'))
    } finally {
      setBusyKey(null)
    }
  }

  const columns = useMemo<ColumnDef<ContractCatalogRow>[]>(
    () => [
      {
        id: 'number',
        header: t('Contract #', 'رقم العقد'),
        cell: ({ row }) => {
          const number = primaryDocumentNumber(row.original)
          return number ? (
            <span className="font-mono text-sm font-medium">{number}</span>
          ) : (
            <span className="font-mono text-xs text-muted-foreground">{t('Pending', 'معلق')}</span>
          )
        },
      },
      {
        id: 'status',
        header: t('Status', 'الحالة'),
        cell: ({ row }) => (
          <ContractGenerationBadge status={row.original.generationStatus} isArabic={isArabic} />
        ),
      },
      {
        id: 'client',
        header: t('Client', 'العميل'),
        cell: ({ row }) => <span className="text-sm">{row.original.company.name}</span>,
      },
      {
        id: 'order',
        header: t('Order', 'الطلب'),
        cell: ({ row }) =>
          row.original.orderNumber ? (
            <Link
              to={orderPath(row.original)}
              className="font-mono text-sm text-primary hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {row.original.orderNumber}
            </Link>
          ) : (
            <span className="font-mono text-xs text-muted-foreground">—</span>
          ),
      },
      {
        id: 'completed',
        header: t('Completed', 'تاريخ الإكمال'),
        cell: ({ row }) =>
          row.original.completedAt ? formatDateTime(row.original.completedAt, locale) : '—',
      },
      {
        id: 'en',
        header: t('English PDF', 'PDF إنجليزي'),
        cell: ({ row }) => {
          const key = `${row.original.slotKey}:en`
          const existing = row.original.en
          return (
            <Button
              type="button"
              variant={existing ? 'secondary' : 'default'}
              size="sm"
              disabled={busyKey === key}
              onClick={(e) => {
                e.stopPropagation()
                void handleLangAction(row.original, 'en')
              }}
            >
              {existing ? t('Open PDF', 'فتح PDF') : t('Create PDF', 'إنشاء PDF')}
            </Button>
          )
        },
      },
      {
        id: 'ar',
        header: t('Arabic PDF', 'PDF عربي'),
        cell: ({ row }) => {
          const key = `${row.original.slotKey}:ar`
          const existing = row.original.ar
          return (
            <Button
              type="button"
              variant={existing ? 'secondary' : 'default'}
              size="sm"
              disabled={busyKey === key}
              onClick={(e) => {
                e.stopPropagation()
                void handleLangAction(row.original, 'ar')
              }}
            >
              {existing ? t('Open PDF', 'فتح PDF') : t('Create PDF', 'إنشاء PDF')}
            </Button>
          )
        },
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8" aria-label={t('Actions', 'إجراءات')}>
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setEditRow(row.original)}>
                {t('Edit fields', 'تعديل الحقول')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [busyKey, isArabic, locale], // eslint-disable-line react-hooks/exhaustive-deps
  )

  const activeFilterCount = [
    appliedFilters.search,
    appliedFilters.companyId,
    appliedFilters.generationStatus,
    appliedFilters.language,
    appliedFilters.createdFrom,
    appliedFilters.createdTo,
  ].filter((v) => String(v).trim()).length

  return (
    <div className="space-y-4">
      <PageHeader title={pageTitle} />

      {pagination.isError ? (
        <Alert variant="destructive">
          <AlertTitle>{t('Failed to load contracts', 'فشل تحميل العقود')}</AlertTitle>
          <AlertDescription>
            <Button variant="link" className="h-auto p-0" onClick={() => pagination.refetch()}>
              {t('Retry', 'إعادة المحاولة')}
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <FilterBar>
        <SearchInput
          value={draftFilters.search}
          onChange={(v) => setDraft({ search: v })}
          placeholder={t('Search contract or order…', 'ابحث عن عقد أو طلب…')}
          className="max-w-sm font-mono"
        />
        <Button type="button" onClick={applyFilters} disabled={pagination.isFetching}>
          {t('Apply filters', 'تطبيق الفلاتر')}
        </Button>
        {activeFilterCount > 0 ? (
          <ResetFiltersButton onClick={resetFilters} label={t('Reset filters', 'إعادة تعيين الفلاتر')} />
        ) : null}
      </FilterBar>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <div className="space-y-2">
          <Label>{t('Client', 'العميل')}</Label>
          <Combobox
            value={draftFilters.companyId}
            onChange={(v) => setDraft({ companyId: v })}
            options={clientFilterOptions}
            placeholder={t('All clients', 'كل العملاء')}
          />
        </div>
        <div className="space-y-2">
          <Label>{t('Generation', 'حالة الإنشاء')}</Label>
          <Select
            value={draftFilters.generationStatus || '__all__'}
            onValueChange={(v) => setDraft({ generationStatus: v === '__all__' ? '' : v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{t('All statuses', 'كل الحالات')}</SelectItem>
              <SelectItem value="pending">{t('Needs generation', 'يحتاج إنشاء')}</SelectItem>
              <SelectItem value="generated">{t('Has PDF', 'يوجد PDF')}</SelectItem>
              <SelectItem value="complete">{t('Both languages', 'اللغتان')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>{t('Language', 'اللغة')}</Label>
          <Select
            value={draftFilters.language || '__all__'}
            onValueChange={(v) => setDraft({ language: v === '__all__' ? '' : v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{t('All languages', 'كل اللغات')}</SelectItem>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="ar">{t('Arabic', 'العربية')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>{t('Completed from', 'تاريخ الإكمال من')}</Label>
          <Input
            type="date"
            value={draftFilters.createdFrom}
            onChange={(e) => setDraft({ createdFrom: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>{t('Completed to', 'تاريخ الإكمال إلى')}</Label>
          <Input
            type="date"
            value={draftFilters.createdTo}
            onChange={(e) => setDraft({ createdTo: e.target.value })}
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={pagination.rows}
        getRowId={(row) => row.slotKey}
        loading={pagination.isInitialLoading}
        empty={<EmptyState title={emptyMessage} />}
        pagination={{
          page: pagination.page,
          pageSize: pagination.pageSize,
          total: pagination.total,
          onPageChange: pagination.setPage,
          onPageSizeChange: () => {},
        }}
      />

      <EditDocumentSlotDialog
        open={!!editRow}
        row={editRow}
        onClose={() => setEditRow(null)}
        onSaved={() => void queryClient.invalidateQueries({ queryKey: queryKeyPrefix })}
      />
    </div>
  )
}
