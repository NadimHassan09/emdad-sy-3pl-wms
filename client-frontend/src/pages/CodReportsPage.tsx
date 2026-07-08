import { useMemo } from 'react';
import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';

import type { Column } from '@wms/components/DataTable';
import { DataTable } from '@wms/components/DataTable';
import { FilterPanel } from '@wms/components/FilterPanel';
import { SelectField } from '@wms/components/SelectField';
import { TextField } from '@wms/components/TextField';
import { useFilters } from '@wms/hooks/useFilters';
import {
  CHUNK_SIZE_STANDARD,
  useChunkedServerPagination,
} from '@wms/hooks/useChunkedServerPagination';

import { isClientArabic } from '../lib/client-ui-language';
import {
  fetchClientCodReport,
  type ClientCodReportRow,
} from '../services/clientOmsOrdersService';

const COD_STATUS_OPTIONS = [
  { value: '', label: 'All COD statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'collected', label: 'Collected' },
  { value: 'remitted', label: 'Remitted' },
  { value: 'settled', label: 'Settled' },
];

type CodDraft = {
  codStatus: string;
  dateFrom: string;
  dateTo: string;
};

function labelText(label: string, isArabic: boolean): string {
  if (!isArabic) return label;
  const ar: Record<string, string> = {
    'COD reports': 'تقارير COD',
    'Report filters': 'فلاتر التقرير',
    'Apply filters': 'تطبيق الفلاتر',
    'Reset filters': 'إعادة تعيين الفلاتر',
    'COD status': 'حالة COD',
    'From date': 'من تاريخ',
    'To date': 'إلى تاريخ',
    'Order #': 'رقم الطلب',
    Recipient: 'المستلم',
    'COD amount': 'مبلغ COD',
    Created: 'تاريخ الإنشاء',
    'No COD orders found.': 'لا توجد بيانات COD.',
    rows: 'صف',
    results: 'نتيجة',
    of: 'من',
    Previous: 'السابق',
    Next: 'التالي',
    'Rows per page': 'عدد الصفوف لكل صفحة',
  };
  return ar[label] ?? label;
}

export function CodReportsPage(): ReactElement {
  const isArabic = isClientArabic();
  const t = (label: string) => labelText(label, isArabic);
  const initial = useMemo<CodDraft>(() => ({ codStatus: '', dateFrom: '', dateTo: '' }), []);
  const { draftFilters, appliedFilters, setDraft, applyFilters, resetFilters } =
    useFilters(initial);

  const filterKey = useMemo(
    () => ({
      codStatus: appliedFilters.codStatus.trim() || undefined,
      dateFrom: appliedFilters.dateFrom.trim() || undefined,
      dateTo: appliedFilters.dateTo.trim() || undefined,
    }),
    [appliedFilters],
  );

  const pagination = useChunkedServerPagination<ClientCodReportRow>({
    chunkSize: CHUNK_SIZE_STANDARD,
    filterKey,
    fetchChunk: (offset, limit) => fetchClientCodReport({ ...filterKey, offset, limit }),
    rtQueryKeyPrefix: ['client', 'cod-report'],
    chunkQueryKeyPrefix: 'client-cod-report-chunk',
  });

  const columns: Column<ClientCodReportRow>[] = useMemo(
    () => [
      {
        header: t('Order #'),
        accessor: (row) => (
          <Link to={`/outbound-orders/${row.id}`} style={{ textDecoration: 'none' }}>
            {row.orderNumber}
          </Link>
        ),
      },
      {
        header: t('Recipient'),
        accessor: (row) => row.recipientName ?? '—',
      },
      {
        header: t('COD amount'),
        accessor: (row) => row.codAmount ?? '—',
        className: 'num',
      },
      {
        header: t('COD status'),
        accessor: (row) => row.codStatus ?? '—',
      },
      {
        header: t('Created'),
        accessor: (row) => new Date(row.createdAt).toLocaleDateString(),
      },
    ],
    [isArabic],
  );

  return (
    <main className="main">
      <FilterPanel
        title={t('Report filters')}
        onApply={applyFilters}
        onReset={resetFilters}
        loading={pagination.isFetching}
        applyLabel={t('Apply filters')}
        resetLabel={t('Reset filters')}
      >
        <SelectField
          label={t('COD status')}
          value={draftFilters.codStatus}
          onChange={(e) => setDraft({ codStatus: e.target.value })}
          options={COD_STATUS_OPTIONS}
        />
        <TextField
          label={t('From date')}
          type="date"
          value={draftFilters.dateFrom}
          onChange={(e) => setDraft({ dateFrom: e.target.value })}
        />
        <TextField
          label={t('To date')}
          type="date"
          value={draftFilters.dateTo}
          onChange={(e) => setDraft({ dateTo: e.target.value })}
        />
      </FilterPanel>

      <DataTable
        title={t('COD reports')}
        titleAs="h1"
        columns={columns}
        rows={pagination.rows}
        rowKey={(row) => row.id}
        loading={pagination.isInitialLoading}
        empty={t('No COD orders found.')}
        serverPagination={pagination.serverPagination}
        labels={{
          rowsSuffix: t('rows'),
          resultsSuffix: t('results'),
          ofWord: t('of'),
          previous: t('Previous'),
          next: t('Next'),
          rowsPerPageAria: t('Rows per page'),
        }}
      />
    </main>
  );
}
