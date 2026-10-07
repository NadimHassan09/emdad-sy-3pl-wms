import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { useUiPreferences } from '@emdad/core'
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
import { MoreHorizontal, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { CompaniesApi } from '@/api/companies'
import { DocumentsApi, type ContractGenerationFilter, type DocumentLang } from '@/api/documents'
import { FinalContractsApi, type FinalContractRow } from '@/api/final-contracts'
import { QK } from '@/constants/query-keys'
import { CHUNK_SIZE_STANDARD, useChunkedServerPagination } from '@/hooks/useChunkedServerPagination'
import { useFilters } from '@/hooks/useFilters'
import { companyFilterComboboxOptions } from '@/lib/company-filter-options'
import { ContractGenerationBadge } from './contracts-ui'
import { CreateFinalContractDialog } from './CreateFinalContractDialog'

type FinalContractFilters = {
  search: string
  companyId: string
  generationStatus: string
  issueFrom: string
  issueTo: string
}

export function FinalContractPage() {
  const { isArabic } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const queryClient = useQueryClient()

  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [editContract, setEditContract] = useState<FinalContractRow | null>(null)

  const initialFilters = useMemo<FinalContractFilters>(
    () => ({
      search: '',
      companyId: '',
      generationStatus: '',
      issueFrom: '',
      issueTo: '',
    }),
    [],
  )

  const { draftFilters, appliedFilters, setDraft, applyFilters, resetFilters } =
    useFilters(initialFilters)

  const listParams = useMemo(
    () => ({
      companyId: appliedFilters.companyId || undefined,
      search: appliedFilters.search.trim() || undefined,
      generationStatus: (appliedFilters.generationStatus.trim() || undefined) as
        | ContractGenerationFilter
        | undefined,
      issueFrom: appliedFilters.issueFrom.trim() || undefined,
      issueTo: appliedFilters.issueTo.trim() || undefined,
    }),
    [appliedFilters],
  )

  const pagination = useChunkedServerPagination<FinalContractRow>({
    chunkSize: CHUNK_SIZE_STANDARD,
    filterKey: listParams,
    fetchChunk: (offset, limit) => FinalContractsApi.list({ ...listParams, offset, limit }),
    rtQueryKeyPrefix: QK.contractsFinalContract,
    chunkQueryKeyPrefix: 'final-contracts-chunk',
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

  async function handleLangAction(row: FinalContractRow, lang: DocumentLang) {
    const key = `${row.id}:${lang}`
    setBusyKey(key)
    try {
      const slot = lang === 'en' ? row.en : row.ar
      if (slot) {
        await DocumentsApi.openInNewTab(slot.documentId)
        return
      }

      const created = await FinalContractsApi.generatePdf(row.id, lang)
      await queryClient.invalidateQueries({ queryKey: QK.contractsFinalContract })
      if (created?.id) await DocumentsApi.openInNewTab(created.id)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('Could not open PDF.', 'تعذر فتح PDF.'))
    } finally {
      setBusyKey(null)
    }
  }

  const columns = useMemo<ColumnDef<FinalContractRow>[]>(
    () => [
      {
        id: 'number',
        header: t('Contract #', 'رقم العقد'),
        cell: ({ row }) => (
          <span className="font-mono text-sm font-medium">{row.original.contractNumber}</span>
        ),
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
        id: 'clientCo',
        header: t('Client company', 'شركة العميل'),
        cell: ({ row }) => <span className="text-sm">{row.original.clientCompanyName}</span>,
      },
      {
        id: 'issue',
        header: t('Issue date', 'تاريخ الإصدار'),
        cell: ({ row }) => <span className="text-sm">{row.original.issueDate}</span>,
      },
      {
        id: 'en',
        header: t('English PDF', 'PDF إنجليزي'),
        cell: ({ row }) => (
          <Button
            type="button"
            variant={row.original.en ? 'secondary' : 'default'}
            size="sm"
            disabled={busyKey === `${row.original.id}:en`}
            onClick={(e) => {
              e.stopPropagation()
              void handleLangAction(row.original, 'en')
            }}
          >
            {row.original.en ? t('Open PDF', 'فتح PDF') : t('Create PDF', 'إنشاء PDF')}
          </Button>
        ),
      },
      {
        id: 'ar',
        header: t('Arabic PDF', 'PDF عربي'),
        cell: ({ row }) => (
          <Button
            type="button"
            variant={row.original.ar ? 'secondary' : 'default'}
            size="sm"
            disabled={busyKey === `${row.original.id}:ar`}
            onClick={(e) => {
              e.stopPropagation()
              void handleLangAction(row.original, 'ar')
            }}
          >
            {row.original.ar ? t('Open PDF', 'فتح PDF') : t('Create PDF', 'إنشاء PDF')}
          </Button>
        ),
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
              <DropdownMenuItem onClick={() => setEditContract(row.original)}>
                {t('Edit contract', 'تعديل العقد')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [busyKey, isArabic], // eslint-disable-line react-hooks/exhaustive-deps
  )

  const activeFilterCount = [
    appliedFilters.search,
    appliedFilters.companyId,
    appliedFilters.generationStatus,
    appliedFilters.issueFrom,
    appliedFilters.issueTo,
  ].filter((v) => String(v).trim()).length

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('Final contracts', 'العقود النهائية')}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" aria-hidden />
            {t('Create final contract', 'إنشاء عقد نهائي')}
          </Button>
        }
      />

      {pagination.isError ? (
        <Alert variant="destructive">
          <AlertTitle>{t('Failed to load final contracts', 'فشل تحميل العقود النهائية')}</AlertTitle>
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
          placeholder={t('Search…', 'ابحث…')}
          className="max-w-sm font-mono"
        />
        <Button type="button" onClick={applyFilters} disabled={pagination.isFetching}>
          {t('Apply filters', 'تطبيق الفلاتر')}
        </Button>
        {activeFilterCount > 0 ? (
          <ResetFiltersButton onClick={resetFilters} label={t('Reset filters', 'إعادة تعيين الفلاتر')} />
        ) : null}
      </FilterBar>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
          <Label>{t('Issue from', 'تاريخ الإصدار من')}</Label>
          <Input type="date" value={draftFilters.issueFrom} onChange={(e) => setDraft({ issueFrom: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>{t('Issue to', 'تاريخ الإصدار إلى')}</Label>
          <Input type="date" value={draftFilters.issueTo} onChange={(e) => setDraft({ issueTo: e.target.value })} />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={pagination.rows}
        getRowId={(row) => row.id}
        loading={pagination.isInitialLoading}
        empty={
          <EmptyState
            title={t('No final contracts match the filters.', 'لا توجد عقود نهائية مطابقة للفلاتر.')}
          />
        }
        pagination={{
          page: pagination.page,
          pageSize: pagination.pageSize,
          total: pagination.total,
          onPageChange: pagination.setPage,
          onPageSizeChange: () => {},
        }}
      />

      <CreateFinalContractDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSaved={() => void queryClient.invalidateQueries({ queryKey: QK.contractsFinalContract })}
      />

      <CreateFinalContractDialog
        open={!!editContract}
        contract={editContract}
        onClose={() => setEditContract(null)}
        onSaved={() => void queryClient.invalidateQueries({ queryKey: QK.contractsFinalContract })}
      />
    </div>
  )
}
