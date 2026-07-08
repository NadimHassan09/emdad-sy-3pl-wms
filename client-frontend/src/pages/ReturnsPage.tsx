import { useMemo } from 'react';
import type { ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';

import type { Column } from '@wms/components/DataTable';
import { DataTable } from '@wms/components/DataTable';
import { StatusBadge } from '@wms/components/StatusBadge';
import {
  CHUNK_SIZE_STANDARD,
  useChunkedServerPagination,
} from '@wms/hooks/useChunkedServerPagination';

import { isClientArabic } from '../lib/client-ui-language';
import {
  fetchClientReturns,
  type ClientReturnOrderRow,
} from '../services/clientReturnsService';

function labelText(label: string, isArabic: boolean): string {
  if (!isArabic) return label;
  const ar: Record<string, string> = {
    Returns: 'المرتجعات',
    'Return #': 'رقم الإرجاع',
    Status: 'الحالة',
    'Original order': 'الطلب الأصلي',
    Lines: 'البنود',
    Created: 'تاريخ الإنشاء',
    'No returns found.': 'لا توجد مرتجعات.',
    rows: 'صف',
    results: 'نتيجة',
    of: 'من',
    Previous: 'السابق',
    Next: 'التالي',
    'Rows per page': 'عدد الصفوف لكل صفحة',
  };
  return ar[label] ?? label;
}

export function ReturnsPage(): ReactElement {
  const navigate = useNavigate();
  const isArabic = isClientArabic();
  const t = (label: string) => labelText(label, isArabic);

  const pagination = useChunkedServerPagination<ClientReturnOrderRow>({
    chunkSize: CHUNK_SIZE_STANDARD,
    filterKey: {},
    fetchChunk: (offset, limit) => fetchClientReturns({ offset, limit }),
    rtQueryKeyPrefix: ['client', 'returns'],
    chunkQueryKeyPrefix: 'client-returns-chunk',
  });

  const columns: Column<ClientReturnOrderRow>[] = useMemo(
    () => [
      {
        header: t('Return #'),
        accessor: (row) => row.orderNumber || row.id.slice(0, 8),
      },
      {
        header: t('Status'),
        accessor: (row) => <StatusBadge status={row.status} />,
      },
      {
        header: t('Original order'),
        accessor: (row) => row.originalOutbound?.orderNumber ?? '—',
      },
      {
        header: t('Lines'),
        accessor: (row) => row._count?.lines ?? 0,
        className: 'num',
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
      <DataTable
        title={t('Returns')}
        titleAs="h1"
        columns={columns}
        rows={pagination.rows}
        rowKey={(row) => row.id}
        loading={pagination.isInitialLoading}
        onRowClick={(row) => navigate(`/returns/${row.id}`)}
        empty={t('No returns found.')}
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
