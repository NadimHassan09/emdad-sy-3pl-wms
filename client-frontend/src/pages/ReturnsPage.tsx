import type { ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  CHUNK_SIZE_STANDARD,
  useChunkedServerPagination,
} from '../hooks/useChunkedServerPagination';

import { Badge } from '../design-v2/Badge';
import { Card } from '../design-v2/Card';
import { ListPageHeader } from '../design-v2/ListPageHeader';
import { StorePillTabs } from '../design-v2/StorePillTabs';
import { TableFooterPagination } from '../design-v2/TableFooterPagination';
import { isClientArabic } from '../lib/client-ui-language';
import { fetchClientReturns, type ClientReturnOrderRow } from '../services/clientReturnsService';

function labelText(label: string, isArabic: boolean): string {
  if (!isArabic) return label;
  const ar: Record<string, string> = {
    Returns: 'المرتجعات',
    'Online, COD, and returns': 'الإلكترونية، الدفع عند الاستلام، والمرتجعات',
    'Return #': 'رقم الإرجاع',
    Status: 'الحالة',
    'Original order': 'الطلب الأصلي',
    Lines: 'البنود',
    Created: 'تاريخ الإنشاء',
    'No returns yet': 'لا توجد مرتجعات بعد',
    'Returns appear here when delivered orders come back to the warehouse.':
      'تظهر المرتجعات هنا عندما تعود الطلبات المسلّمة إلى المستودع.',
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

  return (
    <div className="space-y-5 animate-enter">
      <ListPageHeader icon="fa-rotate-left" title={t('Returns')} subtitle={t('Online, COD, and returns')} />

      <StorePillTabs isArabic={isArabic} />

      <Card className="overflow-hidden">
        {pagination.isInitialLoading ? (
          <div className="px-5 py-10 text-center text-text-faint text-sm">…</div>
        ) : pagination.rows.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-center px-6">
            <div className="w-16 h-16 rounded-2xl bg-surface-sunken flex items-center justify-center mb-4">
              <i className="fa-solid fa-rotate-left text-2xl text-text-faint" />
            </div>
            <h3 className="text-base font-semibold text-text-strong">{t('No returns yet')}</h3>
            <p className="text-sm text-text-muted mt-1 max-w-xs">
              {t('Returns appear here when delivered orders come back to the warehouse.')}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-card-muted text-xs uppercase text-text-muted font-semibold">
                  <tr>
                    <th className="px-5 py-3 text-left">{t('Return #')}</th>
                    <th className="px-5 py-3 text-left">{t('Status')}</th>
                    <th className="px-5 py-3 text-left">{t('Original order')}</th>
                    <th className="px-5 py-3 text-left">{t('Lines')}</th>
                    <th className="px-5 py-3 text-right">{t('Created')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {pagination.rows.map((row) => (
                    <tr
                      key={row.id}
                      onClick={() => navigate(`/returns/${row.id}`)}
                      className="hover:bg-surface-hover transition-colors cursor-pointer"
                    >
                      <td className="px-5 py-3.5 font-semibold text-text-strong font-mono">
                        {row.orderNumber || row.id.slice(0, 8)}
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge status={row.status} />
                      </td>
                      <td className="px-5 py-3.5 text-text-body">{row.originalOutbound?.orderNumber ?? '—'}</td>
                      <td className="px-5 py-3.5 text-text-body">{row._count?.lines ?? 0}</td>
                      <td className="px-5 py-3.5 text-right text-text-muted text-xs">{new Date(row.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <TableFooterPagination pagination={pagination.serverPagination} isArabic={isArabic} />
          </>
        )}
      </Card>
    </div>
  );
}
