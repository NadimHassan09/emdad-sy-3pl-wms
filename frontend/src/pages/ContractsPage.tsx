import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { CompaniesApi } from '../api/companies';
import {
  DocumentsApi,
  type ContractListItem,
  type DocumentLang,
  type DocumentReferenceType,
  type DocumentType,
} from '../api/documents';
import { Alert } from '@ds';
import { Button } from '../components/Button';
import { Column, DataTable } from '../components/DataTable';
import { FilterPanel } from '../components/FilterPanel';
import { Combobox } from '../components/Combobox';
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

type ContractFilters = {
  search: string;
  companyId: string;
  type: string;
  language: string;
  referenceType: string;
  createdFrom: string;
  createdTo: string;
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function contractTypeLabel(type: DocumentType, isArabic: boolean): string {
  if (type === 'grn') return isArabic ? 'GRN' : 'GRN';
  return isArabic ? 'Delivery note' : 'Delivery note';
}

function referenceTypeLabel(referenceType: DocumentReferenceType, isArabic: boolean): string {
  if (referenceType === 'inbound_order') {
    return isArabic ? 'Inbound' : 'Inbound';
  }
  return isArabic ? 'Outbound' : 'Outbound';
}

function orderPath(row: ContractListItem): string {
  return row.referenceType === 'inbound_order'
    ? `/orders/inbound/${row.referenceId}`
    : `/orders/outbound/${row.referenceId}`;
}

export function ContractsPage() {
  const { t, isArabic } = useWmsTranslation();
  const toast = useToast();
  const [openingId, setOpeningId] = useState<string | null>(null);

  const initialFilters = useMemo<ContractFilters>(
    () => ({
      search: '',
      companyId: '',
      type: '',
      language: '',
      referenceType: '',
      createdFrom: '',
      createdTo: '',
    }),
    [],
  );

  const { draftFilters, appliedFilters, setDraft, applyFilters, resetFilters } =
    useFilters(initialFilters);

  const listParams = useMemo(
    () => ({
      companyId: appliedFilters.companyId || undefined,
      search: appliedFilters.search.trim() || undefined,
      type: (appliedFilters.type.trim() || undefined) as DocumentType | undefined,
      language: (appliedFilters.language.trim() || undefined) as DocumentLang | undefined,
      referenceType: (appliedFilters.referenceType.trim() || undefined) as
        | DocumentReferenceType
        | undefined,
      createdFrom: appliedFilters.createdFrom.trim() || undefined,
      createdTo: appliedFilters.createdTo.trim() || undefined,
    }),
    [appliedFilters],
  );

  const pagination = useChunkedServerPagination<ContractListItem>({
    chunkSize: CHUNK_SIZE_STANDARD,
    filterKey: listParams,
    fetchChunk: (offset, limit) => DocumentsApi.listCatalog({ ...listParams, offset, limit }),
    rtQueryKeyPrefix: QK.contracts,
    chunkQueryKeyPrefix: 'contracts-chunk',
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

  async function openPdf(row: ContractListItem) {
    setOpeningId(row.id);
    try {
      await DocumentsApi.openInNewTab(row.id);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t(['Could not open PDF.', 'تعذر فتح PDF.']),
      );
    } finally {
      setOpeningId(null);
    }
  }

  const columns: Column<ContractListItem>[] = useMemo(
    () => [
      {
        header: t(['Contract #', 'رقم العقد']),
        accessor: (row) => <span className="font-mono font-medium text-slate-900">{row.documentNumber}</span>,
        width: '160px',
      },
      {
        header: t(['Type', 'النوع']),
        accessor: (row) => contractTypeLabel(row.type, isArabic),
        width: '120px',
      },
      {
        header: t(['Language', 'اللغة']),
        accessor: (row) => (row.language === 'ar' ? t(['Arabic', 'العربية']) : t(['English', 'English'])),
        width: '90px',
      },
      {
        header: t(['Client', 'العميل']),
        accessor: (row) => row.company.name,
        width: '160px',
      },
      {
        header: t(['Order', 'الطلب']),
        accessor: (row) =>
          row.orderNumber ? (
            <Link
              to={orderPath(row)}
              className="font-mono text-sm text-emerald-700 hover:underline"
              onClick={(event) => event.stopPropagation()}
            >
              {row.orderNumber}
            </Link>
          ) : (
            <span className="font-mono text-xs text-slate-400">—</span>
          ),
        width: '150px',
      },
      {
        header: t(['Source', 'المصدر']),
        accessor: (row) => referenceTypeLabel(row.referenceType, isArabic),
        width: '100px',
      },
      {
        header: t(['Size', 'الحجم']),
        accessor: (row) => (
          <span className="font-mono text-xs text-slate-600">{formatFileSize(row.fileSize)}</span>
        ),
        width: '90px',
      },
      {
        header: t(['Created', 'تاريخ الإنشاء']),
        accessor: (row) => new Date(row.createdAt).toLocaleString(),
        width: '170px',
      },
      {
        header: t(['PDF', 'PDF']),
        accessor: (row) => (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            loading={openingId === row.id}
            onClick={(event) => {
              event.stopPropagation();
              void openPdf(row);
            }}
          >
            {t(['Open', 'فتح'])}
          </Button>
        ),
        width: '90px',
        className: 'text-right',
      },
    ],
    [isArabic, openingId],
  );

  return (
    <>
      {pagination.isError && (
        <Alert
          variant="error"
          title={t(['Failed to load contracts', 'فشل تحميل العقود'])}
          description={t([
            'There was a problem retrieving GRN and delivery note documents.',
            'حدثت مشكلة أثناء جلب مستندات GRN وإشعار التسليم.',
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
        title={t(['Contract filters', 'فلاتر العقود'])}
        description={t([
          'Find GRN and delivery note PDFs by contract number, client, or related order.',
          'ابحث عن PDF لـ GRN وإشعار التسليم برقم العقد أو العميل أو الطلب المرتبط.',
        ])}
        onApply={applyFilters}
        onReset={resetFilters}
        loading={pagination.isFetching}
        applyLabel={t(['Apply filters', 'تطبيق الفلاتر'])}
        resetLabel={t(['Reset filters', 'إعادة تعيين الفلاتر'])}
      >
        <TextField
          label={t(['Contract / order #', 'رقم العقد / الطلب'])}
          value={draftFilters.search}
          onChange={(event) => setDraft({ search: event.target.value })}
          placeholder={t(['Search contract or order…', 'ابحث عن عقد أو طلب…'])}
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
          label={t(['Type', 'النوع'])}
          name="contractTypeFilter"
          value={draftFilters.type}
          onChange={(event) => setDraft({ type: event.target.value })}
          options={[
            { value: '', label: t(['All types', 'كل الأنواع']) },
            { value: 'grn', label: 'GRN' },
            { value: 'delivery_note', label: t(['Delivery note', 'إشعار تسليم']) },
          ]}
        />
        <SelectField
          label={t(['Language', 'اللغة'])}
          name="contractLanguageFilter"
          value={draftFilters.language}
          onChange={(event) => setDraft({ language: event.target.value })}
          options={[
            { value: '', label: t(['All languages', 'كل اللغات']) },
            { value: 'en', label: t(['English', 'English']) },
            { value: 'ar', label: t(['Arabic', 'العربية']) },
          ]}
        />
        <SelectField
          label={t(['Order type', 'نوع الطلب'])}
          name="contractReferenceFilter"
          value={draftFilters.referenceType}
          onChange={(event) => setDraft({ referenceType: event.target.value })}
          options={[
            { value: '', label: t(['All orders', 'كل الطلبات']) },
            { value: 'inbound_order', label: t(['Inbound', 'وارد']) },
            { value: 'outbound_order', label: t(['Outbound', 'صادر']) },
          ]}
        />
        <TextField
          label={t(['Created from', 'تاريخ الإنشاء من'])}
          type="date"
          value={draftFilters.createdFrom}
          onChange={(event) => setDraft({ createdFrom: event.target.value })}
        />
        <TextField
          label={t(['Created to', 'تاريخ الإنشاء إلى'])}
          type="date"
          value={draftFilters.createdTo}
          onChange={(event) => setDraft({ createdTo: event.target.value })}
        />
      </FilterPanel>

      <DataTable
        title={t(['Contracts', 'العقود'])}
        columns={columns}
        rows={pagination.rows}
        rowKey={(row) => row.id}
        serverPagination={pagination.serverPagination}
        loading={pagination.isInitialLoading}
        onRowClick={(row) => void openPdf(row)}
        empty={t([
          'No GRN or delivery note contracts match the filters.',
          'لا توجد عقود GRN أو إشعار تسليم مطابقة للفلاتر.',
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
    </>
  );
}
