import type { ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';

import { Button, EmptyState, ListPageHeader } from '@ds';

import {
  CHUNK_SIZE_STANDARD,
  useChunkedServerPagination,
} from '../hooks/useChunkedServerPagination';

import { Badge } from '../design-v2/Badge';
import { Card } from '../design-v2/Card';
import { StorePillTabs } from '../design-v2/StorePillTabs';
import { TableFooterPagination } from '../design-v2/TableFooterPagination';
import { useClientOperationalAccess } from '../hooks/useClientOperationalAccess';
import { isClientArabic } from '../lib/client-ui-language';
import { fetchClientReturns, type ClientReturnOrderRow } from '../services/clientReturnsService';
import {
  fetchClientOmsReturns,
  type ClientOmsReturnRow,
} from '../services/clientOmsReturnsService';

export type ReturnsSource = 'oms' | 'outbound';

function labelText(label: string, isArabic: boolean): string {
  if (!isArabic) return label;
  const ar: Record<string, string> = {
    'Online returns': 'مرتجعات الطلبات الإلكترونية',
    'Outbound returns': 'مرتجعات الصادر',
    'Returns for online store orders': 'مرتجعات طلبات المتجر الإلكتروني',
    'Returns for warehouse outbound shipments': 'مرتجعات شحنات الصادر من المستودع',
    'Create return': 'إنشاء مرتجع',
    'Create first return': 'إنشاء أول مرتجع',
    'Return #': 'رقم الإرجاع',
    Status: 'الحالة',
    'Linked order': 'الطلب المرتبط',
    Lines: 'البنود',
    Created: 'تاريخ الإنشاء',
    'No returns yet': 'لا توجد مرتجعات بعد',
    'Create a return for an online order.': 'أنشئ مرتجعاً لطلب إلكتروني.',
    'Create a return for a shipped outbound order.': 'أنشئ مرتجعاً لطلب صادر مشحون.',
  };
  return ar[label] ?? label;
}

type ListRow = {
  id: string;
  orderNumber: string;
  status: string;
  createdAt: string;
  linkedLabel: string;
  lineCount: number;
};

function mapWhReturn(row: ClientReturnOrderRow): ListRow {
  return {
    id: row.id,
    orderNumber: row.orderNumber || row.id.slice(0, 8),
    status: row.status,
    createdAt: row.createdAt,
    linkedLabel:
      row.originalOutbound?.orderNumber ??
      (row.clientReference?.startsWith('oms:') ? row.clientReference.slice(4) : '—'),
    lineCount: row._count?.lines ?? 0,
  };
}

function mapOmsReturn(row: ClientOmsReturnRow): ListRow {
  return {
    id: row.id,
    orderNumber: row.returnNumber || row.id.slice(0, 8),
    status: row.status,
    createdAt: row.createdAt,
    linkedLabel: row.omsOrder?.orderNumber ?? '—',
    lineCount: row.lines?.length ?? 0,
  };
}

type Props = {
  source: ReturnsSource;
};

function ReturnsListPage({ source }: Props): ReactElement {
  const navigate = useNavigate();
  const isArabic = isClientArabic();
  const t = (label: string) => labelText(label, isArabic);
  const billingAccess = useClientOperationalAccess(isArabic);

  const basePath = source === 'oms' ? '/ecommerce-orders/returns' : '/outbound-orders/returns';
  const title = source === 'oms' ? t('Online returns') : t('Outbound returns');
  const subtitle =
    source === 'oms'
      ? t('Returns for online store orders')
      : t('Returns for warehouse outbound shipments');
  const emptyDesc =
    source === 'oms'
      ? t('Create a return for an online order.')
      : t('Create a return for a shipped outbound order.');

  const pagination = useChunkedServerPagination<ListRow>({
    chunkSize: CHUNK_SIZE_STANDARD,
    filterKey: { source },
    fetchChunk: async (offset, limit) => {
      if (source === 'oms') {
        const page = await fetchClientOmsReturns({ offset, limit });
        return {
          items: page.items.map(mapOmsReturn),
          total: page.total,
          limit: page.limit,
          offset: page.offset,
        };
      }
      const page = await fetchClientReturns({ offset, limit, source });
      return {
        items: page.items.map(mapWhReturn),
        total: page.total,
        limit: page.limit,
        offset: page.offset,
      };
    },
    rtQueryKeyPrefix: ['client', 'returns', source],
    chunkQueryKeyPrefix: `client-returns-${source}-chunk`,
  });

  const createButton = (
    <Button
      variant="primary"
      size="md"
      disabled={!billingAccess.operationalAllowed}
      title={billingAccess.operationalAllowed ? undefined : billingAccess.actionBlockedReason}
      onClick={() => navigate(`${basePath}/new`)}
      startIcon={<i className="fa-solid fa-plus text-xs" aria-hidden="true" />}
    >
      {t('Create return')}
    </Button>
  );

  return (
    <div className="space-y-5 animate-enter">
      <ListPageHeader
        icon="fa-rotate-left"
        title={title}
        subtitle={subtitle}
        actions={createButton}
      />

      {source === 'oms' ? <StorePillTabs isArabic={isArabic} /> : null}

      <Card className="overflow-hidden">
        {pagination.isInitialLoading ? (
          <div className="px-5 py-10 text-center text-text-faint text-sm">…</div>
        ) : pagination.rows.length === 0 ? (
          <EmptyState
            icon={<i className="fa-solid fa-rotate-left text-2xl" aria-hidden="true" />}
            title={t('No returns yet')}
            description={emptyDesc}
            action={
              billingAccess.operationalAllowed ? (
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => navigate(`${basePath}/new`)}
                  startIcon={<i className="fa-solid fa-plus text-xs" aria-hidden="true" />}
                >
                  {t('Create first return')}
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-card-muted text-xs uppercase text-text-muted font-semibold">
                  <tr>
                    <th className="px-5 py-3 text-left">{t('Return #')}</th>
                    <th className="px-5 py-3 text-left">{t('Status')}</th>
                    <th className="px-5 py-3 text-left">{t('Linked order')}</th>
                    <th className="px-5 py-3 text-left">{t('Lines')}</th>
                    <th className="px-5 py-3 text-right">{t('Created')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {pagination.rows.map((row) => (
                    <tr
                      key={row.id}
                      onClick={() => navigate(`${basePath}/${row.id}`)}
                      className="hover:bg-surface-hover transition-colors cursor-pointer"
                    >
                      <td className="px-5 py-3.5 font-semibold text-text-strong font-mono">
                        {row.orderNumber}
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge status={row.status} />
                      </td>
                      <td className="px-5 py-3.5 text-text-body">{row.linkedLabel}</td>
                      <td className="px-5 py-3.5 text-text-body">{row.lineCount}</td>
                      <td className="px-5 py-3.5 text-right text-text-muted text-xs">
                        {new Date(row.createdAt).toLocaleDateString()}
                      </td>
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

export function EcommerceReturnsPage(): ReactElement {
  return <ReturnsListPage source="oms" />;
}

export function OutboundReturnsPage(): ReactElement {
  return <ReturnsListPage source="outbound" />;
}
