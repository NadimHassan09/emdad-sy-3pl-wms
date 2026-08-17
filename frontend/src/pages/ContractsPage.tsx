import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

import { CompaniesApi } from '../api/companies';
import {
  DocumentsApi,
  type ContractCatalogRow,
  type ContractGenerationFilter,
  type ContractGenerationStatus,
  type DocumentLang,
  type DocumentReferenceType,
  type DocumentType,
} from '../api/documents';
import { Alert } from '@ds';
import { AdminListPageShell } from '../components/AdminListPageShell';
import { Button } from '../components/Button';
import { Column, DataTable } from '../components/DataTable';
import { EditDocumentSlotModal } from '../components/documents/EditDocumentSlotModal';
import { FilterPanel } from '../components/FilterPanel';
import { RowActionsMenu } from '../components/RowActionsMenu';
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
  language: string;
  generationStatus: string;
  createdFrom: string;
  createdTo: string;
};

type ContractsRouteKind = 'grn' | 'dn';

function resolveRouteKind(pathname: string): ContractsRouteKind {
  return pathname.startsWith('/contracts/dn') ? 'dn' : 'grn';
}

function documentTypeForRoute(kind: ContractsRouteKind): DocumentType {
  return kind === 'grn' ? 'grn' : 'delivery_note';
}

function referenceTypeForRoute(kind: ContractsRouteKind): DocumentReferenceType {
  return kind === 'grn' ? 'inbound_order' : 'outbound_order';
}

function orderPath(row: ContractCatalogRow): string {
  return row.referenceType === 'inbound_order'
    ? `/orders/inbound/${row.referenceId}`
    : `/orders/outbound/${row.referenceId}`;
}

function primaryDocumentNumber(row: ContractCatalogRow): string {
  return row.en?.documentNumber ?? row.ar?.documentNumber ?? '';
}

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

export function ContractsPage() {
  const { pathname } = useLocation();
  const routeKind = resolveRouteKind(pathname);
  const documentType = documentTypeForRoute(routeKind);
  const referenceType = referenceTypeForRoute(routeKind);
  const { t, isArabic } = useWmsTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<ContractCatalogRow | null>(null);

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
  );

  const { draftFilters, appliedFilters, setDraft, applyFilters, resetFilters } =
    useFilters(initialFilters);

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
  );

  const queryKeyPrefix = useMemo(
    () => (routeKind === 'grn' ? QK.contractsGrn : QK.contractsDn),
    [routeKind],
  );

  const pagination = useChunkedServerPagination<ContractCatalogRow>({
    chunkSize: CHUNK_SIZE_STANDARD,
    filterKey: listParams,
    fetchChunk: (offset, limit) => DocumentsApi.listCatalog({ ...listParams, offset, limit }),
    rtQueryKeyPrefix: queryKeyPrefix,
    chunkQueryKeyPrefix: routeKind === 'grn' ? 'contracts-grn-chunk' : 'contracts-dn-chunk',
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

  const pageTitle =
    routeKind === 'grn'
      ? t(['Goods receipt notes (GRN)', 'سندات استلام البضاعة (GRN)'])
      : t(['Delivery notes (DN)', 'سندات التسليم (DN)']);

  const emptyMessage =
    routeKind === 'grn'
      ? t(['No GRN slots match the filters.', 'لا توجد GRN مطابقة للفلاتر.'])
      : t(['No delivery note slots match the filters.', 'لا توجد سندات تسليم مطابقة للفلاتر.']);

  const filterDescription =
    routeKind === 'grn'
      ? t([
          'Find GRN slots by order, client, or generation status. Create or open English and Arabic PDFs here.',
          'ابحث عن GRN حسب الطلب أو العميل أو حالة الإنشاء. أنشئ أو افتح PDF بالإنجليزية والعربية من هنا.',
        ])
      : t([
          'Find delivery note slots by order, client, or generation status. Create or open English and Arabic PDFs here.',
          'ابحث عن سندات التسليم حسب الطلب أو العميل أو حالة الإنشاء. أنشئ أو افتح PDF بالإنجليزية والعربية من هنا.',
        ]);

  async function handleLangAction(row: ContractCatalogRow, lang: DocumentLang) {
    const key = `${row.slotKey}:${lang}`;
    setBusyKey(key);
    try {
      const slot = lang === 'en' ? row.en : row.ar;
      if (slot) {
        await DocumentsApi.openInNewTab(slot.documentId);
        return;
      }

      const created =
        row.type === 'grn'
          ? await DocumentsApi.generateGrn(row.taskId, lang)
          : await DocumentsApi.generateDn(row.taskId, lang);

      await queryClient.invalidateQueries({ queryKey: queryKeyPrefix });
      if (created?.id) await DocumentsApi.openInNewTab(created.id);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t(['Could not open PDF.', 'تعذر فتح PDF.']),
      );
    } finally {
      setBusyKey(null);
    }
  }

  const columns: Column<ContractCatalogRow>[] = useMemo(
    () => [
      {
        header: t(['Contract #', 'رقم العقد']),
        accessor: (row) => {
          const number = primaryDocumentNumber(row);
          return number ? (
            <span className="font-mono font-medium text-text-strong">{number}</span>
          ) : (
            <span className="font-mono text-xs text-text-faint">{t(['Pending', 'معلق'])}</span>
          );
        },
        width: '160px',
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
        width: '160px',
      },
      {
        header: t(['Order', 'الطلب']),
        accessor: (row) =>
          row.orderNumber ? (
            <Link
              to={orderPath(row)}
              className="font-mono text-sm text-status-success-fg hover:underline"
              onClick={(event) => event.stopPropagation()}
            >
              {row.orderNumber}
            </Link>
          ) : (
            <span className="font-mono text-xs text-text-faint">—</span>
          ),
        width: '150px',
      },
      {
        header: t(['Completed', 'تاريخ الإكمال']),
        accessor: (row) =>
          row.completedAt ? new Date(row.completedAt).toLocaleString() : '—',
        width: '170px',
      },
      {
        header: t(['English PDF', 'PDF إنجليزي']),
        accessor: (row) => {
          const key = `${row.slotKey}:en`;
          const existing = row.en;
          return (
            <Button
              type="button"
              variant={existing ? 'secondary' : 'primary'}
              size="sm"
              loading={busyKey === key}
              onClick={(event) => {
                event.stopPropagation();
                void handleLangAction(row, 'en');
              }}
            >
              {existing ? t(['Open PDF', 'فتح PDF']) : t(['Create PDF', 'إنشاء PDF'])}
            </Button>
          );
        },
        width: '120px',
        className: 'text-right',
      },
      {
        header: t(['Arabic PDF', 'PDF عربي']),
        accessor: (row) => {
          const key = `${row.slotKey}:ar`;
          const existing = row.ar;
          return (
            <Button
              type="button"
              variant={existing ? 'secondary' : 'primary'}
              size="sm"
              loading={busyKey === key}
              onClick={(event) => {
                event.stopPropagation();
                void handleLangAction(row, 'ar');
              }}
            >
              {existing ? t(['Open PDF', 'فتح PDF']) : t(['Create PDF', 'إنشاء PDF'])}
            </Button>
          );
        },
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
                label: t(['Edit fields', 'تعديل الحقول']),
                onClick: () => setEditRow(row),
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
    <AdminListPageShell icon="fa-file-contract" title={pageTitle} isArabic={isArabic}>
      {pagination.isError && (
        <Alert
          variant="error"
          title={t(['Failed to load contracts', 'فشل تحميل العقود'])}
          description={t([
            'There was a problem retrieving contract documents.',
            'حدثت مشكلة أثناء جلب مستندات العقود.',
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
        description={filterDescription}
        onApply={applyFilters}
        onReset={resetFilters}
        loading={pagination.isFetching}
        applyLabel={t(['Apply filters', 'تطبيق الفلاتر'])}
        resetLabel={t(['Reset filters', 'إعادة تعيين الفلاتر'])}
        compact={
          <TextField
            label={t(['Contract / order #', 'رقم العقد / الطلب'])}
            value={draftFilters.search}
            onChange={(event) => setDraft({ search: event.target.value })}
            placeholder={t(['Search contract or order…', 'ابحث عن عقد أو طلب…'])}
            className="font-mono"
          />
        }
        activeCount={[appliedFilters.search, appliedFilters.companyId, appliedFilters.generationStatus, appliedFilters.language, appliedFilters.createdFrom, appliedFilters.createdTo].filter((v) => String(v).trim()).length}
        advancedLabel={t(['Advanced Filtering', 'تصفية متقدمة'])}
        collapseLabel={t(['Collapse', 'إخفاء'])}
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
          label={t(['Generation', 'حالة الإنشاء'])}
          name="contractGenerationFilter"
          value={draftFilters.generationStatus}
          onChange={(event) => setDraft({ generationStatus: event.target.value })}
          options={[
            { value: '', label: t(['All statuses', 'كل الحالات']) },
            { value: 'pending', label: t(['Needs generation', 'يحتاج إنشاء']) },
            { value: 'generated', label: t(['Has PDF', 'يوجد PDF']) },
            { value: 'complete', label: t(['Both languages', 'اللغتان']) },
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
        <TextField
          label={t(['Completed from', 'تاريخ الإكمال من'])}
          type="date"
          value={draftFilters.createdFrom}
          onChange={(event) => setDraft({ createdFrom: event.target.value })}
        />
        <TextField
          label={t(['Completed to', 'تاريخ الإكمال إلى'])}
          type="date"
          value={draftFilters.createdTo}
          onChange={(event) => setDraft({ createdTo: event.target.value })}
        />
      </FilterPanel>

      <DataTable
        columns={columns}
        rows={pagination.rows}
        rowKey={(row) => row.slotKey}
        serverPagination={pagination.serverPagination}
        loading={pagination.isInitialLoading}
        empty={emptyMessage}
        labels={{
          rowsSuffix: t(['rows', 'صف']),
          resultsSuffix: t(['results', 'نتيجة']),
          ofWord: t(['of', 'من']),
          previous: t(['Previous', 'السابق']),
          next: t(['Next', 'التالي']),
          rowsPerPageAria: t(['Rows per page', 'عدد الصفوف لكل صفحة']),
        }}
      />

      <EditDocumentSlotModal
        open={!!editRow}
        row={editRow}
        onClose={() => setEditRow(null)}
        onSaved={() => void queryClient.invalidateQueries({ queryKey: queryKeyPrefix })}
      />
    </AdminListPageShell>
  );
}
