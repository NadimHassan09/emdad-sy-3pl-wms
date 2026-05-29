import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useAuth } from '../../auth/AuthContext';
import { CycleCountApi, type BlindCycleCountTaskListItem } from '../../api/cycle-count';
import { Button } from '../../components/Button';
import { Column, DataTable } from '../../components/DataTable';
import { PageHeader } from '../../components/PageHeader';
import { StatusBadge } from '../../components/StatusBadge';
import { QK } from '../../constants/query-keys';
import { useDefaultWarehouseId } from '../../hooks/useDefaultWarehouse';
import { canExecuteCycleCount } from '../../lib/rbac';

export function CycleCountMyTasksPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canExecute = canExecuteCycleCount(user);
  const { warehouseId: wid } = useDefaultWarehouseId();
  const isArabic =
    typeof window !== 'undefined' &&
    (window.localStorage.getItem('wms-ui-language') === 'AR' || document.documentElement.dir === 'rtl');
  const t = (en: string, ar: string) => (isArabic ? ar : en);

  const tasks = useQuery({
    queryKey: QK.cycleCount.myTasks(wid ?? ''),
    queryFn: () => CycleCountApi.listMyTasks(wid || undefined),
    enabled: !!wid && canExecute,
    refetchInterval: canExecute ? 30_000 : false,
  });

  const cols: Column<BlindCycleCountTaskListItem>[] = useMemo(
    () => [
      {
        header: t('Warehouse', 'المستودع'),
        accessor: (r) => r.warehouse.code,
        width: '100px',
      },
      {
        header: t('Status', 'الحالة'),
        accessor: (r) => <StatusBadge status={r.status} />,
        width: '120px',
      },
      {
        header: t('Progress', 'التقدم'),
        accessor: (r) => {
          const done = r.progress.totalLines - r.progress.pending;
          return (
            <span className="font-mono text-xs">
              {done}/{r.progress.totalLines}
            </span>
          );
        },
        width: '88px',
        className: 'text-right',
      },
      {
        header: t('Pending', 'متبقي'),
        accessor: (r) => (
          <span className={`font-mono text-sm ${r.progress.pending > 0 ? 'font-semibold' : ''}`}>
            {r.progress.pending}
          </span>
        ),
        width: '72px',
        className: 'text-right',
      },
      {
        header: t('Scope', 'النطاق'),
        accessor: (r) => <span className="text-xs capitalize">{r.assignmentScope}</span>,
        width: '88px',
      },
    ],
    [isArabic],
  );

  if (!canExecute) {
    return (
      <div>
        <PageHeader
          title={t('My cycle counts', 'مهام الجرد')}
          description={t(
            'Blind count execution is only available for warehouse operators with a linked Worker profile.',
            'تنفيذ الجرد الأعمى متاح فقط لمشغلي المستودع المرتبطين بملف عامل.',
          )}
          actions={
            <Link to="/cycle-count">
              <Button variant="ghost">{t('Dashboard', 'لوحة الجرد')}</Button>
            </Link>
          }
        />
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {t(
            'Your account is not linked to a Worker profile. Sign in as a warehouse operator, or ask an admin to link your user under Users → Warehouse users.',
            'حسابك غير مرتبط بملف عامل. سجّل الدخول كمشغل مستودع، أو اطلب من المسؤول ربط المستخدم من المستخدمين → مستخدمو المستودع.',
          )}
        </p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={t('My cycle counts', 'مهام الجرد')}
        description={t('Assigned count sessions — tap to execute.', 'جلسات الجرد المكلفة — اضغط للتنفيذ.')}
        actions={
          <Link to="/cycle-count">
            <Button variant="ghost">{t('Dashboard', 'لوحة الجرد')}</Button>
          </Link>
        }
      />

      <DataTable<BlindCycleCountTaskListItem>
        columns={cols}
        rows={tasks.data ?? []}
        loading={tasks.isLoading}
        empty={t('No count tasks assigned.', 'لا مهام جرد مكلفة.')}
        onRowClick={(r) => navigate(`/cycle-count/${r.id}/execute`)}
        rowKey={(r) => r.id}
      />
    </div>
  );
}
