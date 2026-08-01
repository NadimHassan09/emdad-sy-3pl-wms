import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { CompaniesApi } from '../api/companies';
import { DocumentsApi, type ContractGenerationFilter, type ContractGenerationStatus, type DocumentLang } from '../api/documents';
import { FinalContractsApi, type FinalContractRow } from '../api/final-contracts';
import { Alert } from '@ds';
import { AdminListPageShell } from '../components/AdminListPageShell';
import { Button } from '../components/Button';
import { Column, DataTable } from '../components/DataTable';
import { FilterPanel } from '../components/FilterPanel';
import { Combobox } from '../components/Combobox';
import { CreateFinalContractModal } from '../components/final-contracts/CreateFinalContractModal';
import { RowActionsMenu } from '../components/RowActionsMenu';
import { SelectField } from '../components/SelectField';
import { TextField } from '../components/TextField';
import { useToast } from '../components/ToastProvider';
import { QK } from '../constants/query-keys';
import { useFilters } from '../hooks/useFilters';
import {
  CHUNK_SIZE_STANDARD,
  useChunkedServerPagination,
} from '../hooks/useChunkedServerPagination';
import { companyFilterComboboxOptions } from '../lib/company-filter-options';
import { useWmsTranslation } from '../lib/ui-i18n';

type FinalContractFilters = {
  search: string;
  companyId: string;
  generationStatus: string;
  issueFrom: string;
  issueTo: string;
};

function generationStatusLabel(
  status: ContractGenerationStatus,
  t: (message: [string, string]) => string,
): string {
  if (status === 'complete') return t(['Complete', 'مكتمل']);
  if (status === 'partial') return t(['Partial', 'جزئي']);
  return t(['Not generated', 'لم يُنشأ']);
}

function generationStatusClass(status: ContractGenerationStatus): string {
  if (status === 'complete') return 'bg-status-success-bg text-status-success-fg';
  if (status === 'partial') return 'bg-status-warning-bg text-status-warning-fg';
  return 'bg-surface-card-muted text-text-body';
}

export function FinalContractPage() {
  const { t, isArabic } = useWmsTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editContract, setEditContract] = useState<FinalContractRow | null>(null);

  const initialFilters = useMemo<FinalContractFilters>(
    () => ({
      search: '',
      companyId: '',
      generationStatus: '',
      issueFrom: '',
      issueTo: '',
    }),
    [],
  );

  const { draftFilters, appliedFilters, setDraft, applyFilters, resetFilters } =
    useFilters(initialFilters);

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
  );

  const pagination = useChunkedServerPagination<FinalContractRow>({
    chunkSize: CHUNK_SIZE_STANDARD,
    filterKey: listParams,
    fetchChunk: (offset, limit) => FinalContractsApi.list({ ...listParams, offset, limit }),
    rtQueryKeyPrefix: QK.contractsFinalContract,
    chunkQueryKeyPrefix: 'final-contracts-chunk',
  });

  const companies = useQuery({
    queryKey: QK.companies,
    queryFn: () => CompaniesApi.list(),
    staleTime: 10 * 60_000,
  });

  const clientFilterOptions = useMemo(
    () => companyFilterComboboxOptions(companies.data, t(['All clients', 'كل العملاء'])),
    [companies.data, isArabic],
  );

  async function handleLangAction(row: FinalContractRow, lang: DocumentLang) {
    const key = `${row.id}:${lang}`;
    setBusyKey(key);
    try {
      const slot = lang === 'en' ? row.en : row.ar;
      if (slot) {
        await DocumentsApi.openInNewTab(slot.documentId);
        return;
      }

      const created = await FinalContractsApi.generatePdf(row.id, lang);
      await queryClient.invalidateQueries({ queryKey: QK.contractsFinalContract });
      if (created?.id) await DocumentsApi.openInNewTab(created.id);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t(['Could not open PDF.', 'تعذر فتح PDF.']),
      );
    } finally {
      setBusyKey(null);
    }
  }

  const columns: Column<FinalContractRow>[] = useMemo(
    () => [
      {
        header: t(['Contract #', 'رقم العقد']),
        accessor: (row) => (
          <span className="font-mono font-medium text-text-strong">{row.contractNumber}</span>
        ),
        width: '150px',
      },
      {
        header: t(['Status', 'الحالة']),
        accessor: (row) => (
          <span
            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${generationStatusClass(row.generationStatus)}`}
          >
            {generationStatusLabel(row.generationStatus, t)}
          </span>
        ),
        width: '120px',
      },
      {
        header: t(['Client', 'العميل']),
        accessor: (row) => row.company.name,
        width: '150px',
      },
      {
        header: t(['Client company', 'شركة العميل']),
        accessor: (row) => row.clientCompanyName,
        width: '180px',
      },
      {
        header: t(['Issue date', 'تاريخ الإصدار']),
        accessor: (row) => row.issueDate,
        width: '120px',
      },
      {
        header: t(['English PDF', 'PDF إنجليزي']),
        accessor: (row) => (
          <Button
            type="button"
            variant={row.en ? 'secondary' : 'primary'}
            size="sm"
            loading={busyKey === `${row.id}:en`}
            onClick={(event) => {
              event.stopPropagation();
              void handleLangAction(row, 'en');
            }}
          >
            {row.en ? t(['Open PDF', 'فتح PDF']) : t(['Create PDF', 'إنشاء PDF'])}
          </Button>
        ),
        width: '120px',
        className: 'text-right',
      },
      {
        header: t(['Arabic PDF', 'PDF عربي']),
        accessor: (row) => (
          <Button
            type="button"
            variant={row.ar ? 'secondary' : 'primary'}
            size="sm"
            loading={busyKey === `${row.id}:ar`}
            onClick={(event) => {
              event.stopPropagation();
              void handleLangAction(row, 'ar');
            }}
          >
            {row.ar ? t(['Open PDF', 'فتح PDF']) : t(['Create PDF', 'إنشاء PDF'])}
          </Button>
        ),
        width: '120px',
        className: 'text-right',
      },
      {
        header: t(['Actions', 'إجراءات']),
        accessor: (row) => (
          <RowActionsMenu
            ariaLabel={t(['Open actions', 'فتح الإجراءات'])}
            items={[
              {
                key: 'edit',
                label: t(['Edit contract', 'تعديل العقد']),
                onClick: () => setEditContract(row),
              },
            ]}
          />
        ),
        width: '80px',
        className: 'text-right',
      },
    ],
    [busyKey, isArabic],
  );

  return (
    <AdminListPageShell
      icon="fa-file-signature"
      title={t(['Final contracts', 'العقود النهائية'])}
      isArabic={isArabic}
      actions={
        <Button type="button" onClick={() => setCreateOpen(true)}>
          {t(['+ Create final contract', '+ إنشاء عقد نهائي'])}
        </Button>
      }
    >
      {pagination.isError && (
        <Alert
          variant="error"
          title={t(['Failed to load final contracts', 'فشل تحميل العقود النهائية'])}
          description={t([
            'There was a problem retrieving final warehouse contracts.',
            'حدثت مشكلة أثناء جلب عقود المستودع النهائية.',
          ])}
          className="mb-4"
          onDismiss={() => pagination.refetch()}
        >
          <Alert.Action onClick={() => pagination.refetch()}>
            {t(['Retry', 'إعادة المحاولة'])}
          </Alert.Action>
        </Alert>
      )}

      <FilterPanel
        title={t(['Final contract filters', 'فلاتر العقد النهائي'])}
        description={t([
          'Find 3PL warehouse contracts by number, client, or generation status.',
          'ابحث عن عقود المستودع 3PL برقم العقد أو العميل أو حالة الإنشاء.',
        ])}
        onApply={applyFilters}
        onReset={resetFilters}
        loading={pagination.isFetching}
        applyLabel={t(['Apply filters', 'تطبيق الفلاتر'])}
        resetLabel={t(['Reset filters', 'إعادة تعيين الفلاتر'])}
      >
        <TextField
          label={t(['Contract # / client', 'رقم العقد / العميل'])}
          value={draftFilters.search}
          onChange={(event) => setDraft({ search: event.target.value })}
          placeholder={t(['Search…', 'ابحث…'])}
          className="font-mono"
        />
        <Combobox
          label={t(['Client', 'العميل'])}
          value={draftFilters.companyId}
          onChange={(value) => setDraft({ companyId: value })}
          options={clientFilterOptions}
          placeholder={t(['All clients', 'كل العملاء'])}
        />
        <SelectField
          label={t(['Generation', 'حالة الإنشاء'])}
          name="finalContractGenerationFilter"
          value={draftFilters.generationStatus}
          onChange={(event) => setDraft({ generationStatus: event.target.value })}
          options={[
            { value: '', label: t(['All statuses', 'كل الحالات']) },
            { value: 'pending', label: t(['Needs generation', 'يحتاج إنشاء']) },
            { value: 'generated', label: t(['Has PDF', 'يوجد PDF']) },
            { value: 'complete', label: t(['Both languages', 'اللغتان']) },
          ]}
        />
        <TextField
          label={t(['Issue from', 'تاريخ الإصدار من'])}
          type="date"
          value={draftFilters.issueFrom}
          onChange={(event) => setDraft({ issueFrom: event.target.value })}
        />
        <TextField
          label={t(['Issue to', 'تاريخ الإصدار إلى'])}
          type="date"
          value={draftFilters.issueTo}
          onChange={(event) => setDraft({ issueTo: event.target.value })}
        />
      </FilterPanel>

      <DataTable
        columns={columns}
        rows={pagination.rows}
        rowKey={(row) => row.id}
        serverPagination={pagination.serverPagination}
        loading={pagination.isInitialLoading}
        empty={t([
          'No final contracts match the filters.',
          'لا توجد عقود نهائية مطابقة للفلاتر.',
        ])}
        labels={{
          rowsSuffix: t(['rows', 'صف']),
          resultsSuffix: t(['results', 'نتيجة']),
          ofWord: t(['of', 'من']),
          previous: t(['Previous', 'السابق']),
          next: t(['Next', 'التالي']),
          rowsPerPageAria: t(['Rows per page', 'عدد الصفوف لكل صفحة']),
        }}
      />

      <CreateFinalContractModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSaved={() => void queryClient.invalidateQueries({ queryKey: QK.contractsFinalContract })}
      />

      <CreateFinalContractModal
        open={!!editContract}
        contract={editContract}
        onClose={() => setEditContract(null)}
        onSaved={() => void queryClient.invalidateQueries({ queryKey: QK.contractsFinalContract })}
      />
    </AdminListPageShell>
  );
}
