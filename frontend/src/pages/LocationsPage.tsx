import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { Warehouse, WarehouseStatus, WarehousesApi } from '../api/warehouses';
import { useAuth } from '../auth/AuthContext';
import { AdminListPageShell } from '../components/AdminListPageShell';
import { Button } from '../components/Button';
import { Column, DataTable } from '../components/DataTable';
import { FilterPanel } from '../components/FilterPanel';
import { SelectField } from '../components/SelectField';
import { TextField } from '../components/TextField';
import { QK } from '../constants/query-keys';
import { useFilters } from '../hooks/useFilters';
import { useWmsTranslation } from '../lib/ui-i18n';
import { canAccessPath } from '../lib/rbac';
import { Badge, Card } from '@ds';

type StatusFilter = '' | WarehouseStatus;

type WarehouseListFilters = {
  search: string;
  status: StatusFilter;
  includeInactive: boolean;
};

const INITIAL_FILTERS: WarehouseListFilters = {
  search: '',
  status: '',
  includeInactive: true,
};

function filterWarehouses(rows: Warehouse[], filters?: Partial<WarehouseListFilters>): Warehouse[] {
  const q = (filters?.search ?? '').trim().toLowerCase();
  const status = filters?.status ?? '';
  const includeInactive = filters?.includeInactive ?? true;
  return rows.filter((w) => {
    if (status && w.status !== status) return false;
    if (!includeInactive && w.status !== 'active') return false;
    if (!q) return true;
    return (
      (w.code ?? '').toLowerCase().includes(q) ||
      (w.name ?? '').toLowerCase().includes(q) ||
      (w.city?.toLowerCase().includes(q) ?? false) ||
      (w.country ?? '').toLowerCase().includes(q)
    );
  });
}

export function LocationsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, isArabic } = useWmsTranslation();
  const canManageWarehouses = canAccessPath(user?.role, '/warehouses');

  const { draftFilters, appliedFilters, setDraft, applyFilters, resetFilters } =
    useFilters<WarehouseListFilters>(INITIAL_FILTERS);

  // Fetch warehouses with efficient location counts from backend
  const warehousesQuery = useQuery({
    queryKey: [...QK.warehouses, true],
    queryFn: () => WarehousesApi.list(true),
  });

  const allWarehouses = warehousesQuery.data ?? [];
  const filteredRows = useMemo(
    () => filterWarehouses(allWarehouses, appliedFilters),
    [allWarehouses, appliedFilters],
  );

  // Compute stats across warehouses
  const stats = useMemo(() => {
    const total = allWarehouses.length;
    const active = allWarehouses.filter((w) => w.status === 'active').length;
    const totalLocations = allWarehouses.reduce((sum, w) => sum + (w.locationCount ?? 0), 0);
    return { total, active, totalLocations };
  }, [allWarehouses]);

  const columns: Column<Warehouse>[] = useMemo(
    () => [
      {
        header: t(['Warehouse Code', 'رمز المستودع']),
        accessor: (w) => (
          <span className="font-mono text-xs font-bold text-brand-600 dark:text-brand-400">
            {w.code}
          </span>
        ),
        width: '140px',
      },
      {
        header: t(['Warehouse Name', 'اسم المستودع']),
        accessor: (w) => (
          <div>
            <div className="font-semibold text-text-strong">{w.name}</div>
            {w.address ? <div className="text-xs text-text-muted">{w.address}</div> : null}
          </div>
        ),
      },
      {
        header: t(['Location', 'الموقع الجغرافي']),
        accessor: (w) => (
          <span className="text-sm text-text-body">
            {w.city ? `${w.city}, ${w.country}` : w.country}
          </span>
        ),
        width: '180px',
      },
      {
        header: t(['Status', 'الحالة']),
        accessor: (w) => (
          <Badge tone={w.status === 'active' ? 'success' : 'neutral'} size="xs">
            {w.status === 'active'
              ? t(['Active', 'نشط'])
              : t(['Inactive', 'غير نشط'])}
          </Badge>
        ),
        width: '120px',
      },
      {
        header: t(['Locations', 'المواقع']),
        accessor: (w) => (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-800 dark:bg-brand-950 dark:text-brand-300 ring-1 ring-inset ring-brand-200 dark:ring-brand-800">
            <i className="fa-solid fa-location-dot text-[10px]" />
            <span>
              {t(['{{n}} location(s)', '{{n}} موقع/مواقع']).replace(
                '{{n}}',
                String(w.locationCount ?? 0),
              )}
            </span>
          </span>
        ),
        width: '160px',
      },
      {
        header: t(['Action', 'الإجراء']),
        accessor: (w) => (
          <Link
            to={`/locations/${w.id}`}
            onClick={(e) => e.stopPropagation()}
            className="inline-block"
          >
            <Button variant="secondary" size="sm">
              <span>{t(['Manage locations', 'إدارة المواقع'])}</span>
              <i className="fa-solid fa-arrow-right ms-1.5 text-xs rtl:rotate-180" />
            </Button>
          </Link>
        ),
        width: '180px',
      },
    ],
    [t],
  );

  return (
    <AdminListPageShell
      icon="fa-location-dot"
      title={t(['Warehouse Locations', 'مواقع المستودعات'])}
      subtitle={t([
        'Select a warehouse to navigate and manage its storage locations and hierarchy.',
        'اختر مستودعاً للتنقل في مواقعه التخزينية وتسلسله الهرمي وإدارتها.',
      ])}
      isArabic={isArabic}
      actions={
        canManageWarehouses ? (
          <Link to="/warehouses">
            <Button variant="secondary" size="md">
              <i className="fa-solid fa-warehouse me-1.5" />
              {t(['Manage Warehouses', 'إدارة المستودعات'])}
            </Button>
          </Link>
        ) : null
      }
    >
      {/* Stats Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="flex items-center gap-4 p-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-400">
            <i className="fa-solid fa-warehouse text-xl" />
          </div>
          <div>
            <div className="text-2xl font-bold tracking-tight text-text-strong">
              {stats.total}
            </div>
            <div className="text-xs text-text-muted">
              {t(['Total Warehouses', 'إجمالي المستودعات'])}
            </div>
          </div>
        </Card>

        <Card className="flex items-center gap-4 p-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-status-success-bg text-status-success-fg">
            <i className="fa-solid fa-circle-check text-xl" />
          </div>
          <div>
            <div className="text-2xl font-bold tracking-tight text-text-strong">
              {stats.active}
            </div>
            <div className="text-xs text-text-muted">
              {t(['Active Warehouses', 'المستودعات النشطة'])}
            </div>
          </div>
        </Card>

        <Card className="flex items-center gap-4 p-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-status-info-bg text-status-info-fg">
            <i className="fa-solid fa-location-dot text-xl" />
          </div>
          <div>
            <div className="text-2xl font-bold tracking-tight text-text-strong">
              {stats.totalLocations}
            </div>
            <div className="text-xs text-text-muted">
              {t(['Total Storage Locations', 'إجمالي المواقع التخزينية'])}
            </div>
          </div>
        </Card>
      </div>

      {/* Filter Panel */}
      <FilterPanel
        title={t(['Warehouse filters', 'فلاتر المستودعات'])}
        onApply={applyFilters}
        onReset={resetFilters}
        loading={warehousesQuery.isFetching}
        applyLabel={t(['Apply filters', 'تطبيق الفلاتر'])}
        resetLabel={t(['Reset', 'إعادة تعيين'])}
        compact={
          <TextField
            label={t(['Search', 'بحث'])}
            value={draftFilters?.search ?? ''}
            onChange={(e) => setDraft({ search: e.target.value })}
            placeholder={t(['Search code, name, city…', 'ابحث بالرمز أو الاسم أو المدينة…'])}
          />
        }
        activeCount={
          [draftFilters?.search, draftFilters?.status].filter((v) => Boolean(v && String(v).trim())).length
        }
        advancedLabel={t(['Advanced Filtering', 'تصفية متقدمة'])}
        collapseLabel={t(['Collapsed', 'إخفاء'])}
      >
        <TextField
          label={t(['Search', 'بحث'])}
          value={draftFilters?.search ?? ''}
          onChange={(e) => setDraft({ search: e.target.value })}
          placeholder={t(['Search by code, name, or city…', 'ابحث بالرمز، الاسم، أو المدينة…'])}
        />
        <SelectField
          label={t(['Status', 'الحالة'])}
          name="warehouseStatusFilter"
          value={draftFilters?.status ?? ''}
          onChange={(e) => setDraft({ status: e.target.value as StatusFilter })}
          options={[
            { value: '', label: t(['All statuses', 'كل الحالات']) },
            { value: 'active', label: t(['Active only', 'النشطة فقط']) },
            { value: 'inactive', label: t(['Inactive only', 'غير النشطة فقط']) },
          ]}
        />
      </FilterPanel>

      {/* Warehouses Table */}
      <div className="space-y-2">
        <DataTable<Warehouse>
          columns={columns}
          rows={filteredRows}
          rowKey={(w) => w.id}
          loading={warehousesQuery.isLoading}
          onRowClick={(w) => navigate(`/locations/${w.id}`)}
          empty={
            <div className="py-8 text-center text-sm text-text-muted">
              {warehousesQuery.isError
                ? t(['Failed to load warehouses.', 'تعذّر تحميل بيانات المستودعات.'])
                : t(['No warehouses found matching your filters.', 'لا توجد مستودعات مطابقة لخيارات البحث.'])}
            </div>
          }
        />
      </div>
    </AdminListPageShell>
  );
}

export default LocationsPage;
