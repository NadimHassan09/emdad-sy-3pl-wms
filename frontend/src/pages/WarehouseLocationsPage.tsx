import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { InventoryApi, StockRow } from '../api/inventory';
import { CreateLocationInput, Location, LocationsApi, LocationTreeNode, LocationType } from '../api/locations';
import { WarehousesApi } from '../api/warehouses';
import { AdminListPageShell } from '../components/AdminListPageShell';
import { BarcodeImageModal } from '../components/BarcodeImageModal';
import { BarcodeScanModal } from '../components/BarcodeScanModal';
import { Button } from '../components/Button';
import { ConfirmModal } from '../components/ConfirmModal';
import { FilterPanel } from '../components/FilterPanel';
import { FilterScanButton } from '../components/FilterScanButton';
import { LocationParentPicker } from '../components/locations/LocationParentPicker';
import { LocationsDrillDownTable } from '../components/locations/LocationsDrillDownTable';
import { LocationsTreeTable } from '../components/locations/LocationsTreeTable';
import { Modal } from '../components/Modal';
import { SelectField } from '../components/SelectField';
import { TextField } from '../components/TextField';
import { useToast } from '../components/ToastProvider';
import { QK } from '../constants/query-keys';
import {
  CHUNK_SIZE_STANDARD,
  useChunkedServerPagination,
} from '../hooks/useChunkedServerPagination';
import { useFilters } from '../hooks/useFilters';
import { locationTypeSupportsCapacityFields } from '../lib/location-types';
import { MODAL_CANCEL_BUTTON_CLASS } from '../lib/modal-button-styles';
import { useWmsTranslation } from '../lib/ui-i18n';
import {
  localizedLocationTypeHint,
  localizedLocationTypeSelectOptions,
  localizedManagedTypeOptionsForEdit,
} from '../lib/ui-labels/locations';
import { Badge, Card } from '@ds';

function parseOptionalPositiveDecimal(s: string): number | undefined {
  const t = s.trim();
  if (!t) return undefined;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

function fmtQty(s: string) {
  return Number(s).toLocaleString(undefined, { maximumFractionDigits: 4 });
}

type LocationDraftFilters = { name: string; barcode: string; locationType: string };
type BreadcrumbCrumb = { id: string | null; name: string };

const INCLUDE_ARCHIVED_LOCATIONS = true;

function buildLocationTree(locations: Location[]): {
  roots: LocationTreeNode[];
  resolve: (id: string) => Location | undefined;
} {
  const map = new Map<string, Location>();
  const nodeMap = new Map<string, LocationTreeNode>();

  for (const loc of locations) {
    map.set(loc.id, loc);
    nodeMap.set(loc.id, {
      id: loc.id,
      name: loc.name,
      fullPath: loc.fullPath,
      type: loc.type,
      barcode: loc.barcode,
      children: [],
    });
  }

  const roots: LocationTreeNode[] = [];
  for (const loc of locations) {
    const node = nodeMap.get(loc.id)!;
    if (loc.parentId && nodeMap.has(loc.parentId)) {
      nodeMap.get(loc.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return {
    roots,
    resolve: (id: string) => map.get(id),
  };
}

export function WarehouseLocationsPage() {
  const { warehouseId } = useParams<{ warehouseId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const { t, isArabic } = useWmsTranslation();

  const [viewMode, setViewMode] = useState<'tree' | 'drilldown'>('tree');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const initialLocFilters = useMemo<LocationDraftFilters>(
    () => ({ name: '', barcode: '', locationType: '' }),
    [],
  );
  const { draftFilters, appliedFilters, setDraft, applyFilters, resetFilters } =
    useFilters(initialLocFilters);

  const [trail, setTrail] = useState<BreadcrumbCrumb[]>([{ id: null, name: 'root' }]);
  const [openCreate, setOpenCreate] = useState(false);
  const [editLoc, setEditLoc] = useState<Location | null>(null);
  const [barcodeModal, setBarcodeModal] = useState<{ value: string; contextLabel: string } | null>(null);
  const [stockModal, setStockModal] = useState<Location | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [pendingPermanentDelete, setPendingPermanentDelete] = useState<{
    id: string;
    fullPath: string;
    subtreeSize?: number;
  } | null>(null);

  // Fetch selected warehouse details
  const warehouseQuery = useQuery({
    queryKey: warehouseId ? ['warehouses', 'detail', warehouseId] : ['warehouses', 'none'],
    queryFn: () => WarehousesApi.getById(warehouseId!),
    enabled: Boolean(warehouseId),
  });

  const warehouse = warehouseQuery.data;

  // Query for Tree View: fetch all warehouse locations to assemble tree
  const treeLocationsQuery = useQuery({
    queryKey: ['locations', 'warehouse-tree-all', warehouseId, appliedFilters],
    queryFn: () => {
      const search =
        (appliedFilters?.barcode ?? '').trim() ||
        (appliedFilters?.name ?? '').trim() ||
        undefined;
      const type = (appliedFilters?.locationType ?? '').trim() || undefined;
      return LocationsApi.lookup({
        warehouseId: warehouseId!,
        limit: 1000,
        search,
        type,
        includeArchived: INCLUDE_ARCHIVED_LOCATIONS,
      });
    },
    enabled: Boolean(warehouseId) && viewMode === 'tree',
  });

  const treeData = useMemo(() => {
    return buildLocationTree(treeLocationsQuery.data?.items ?? []);
  }, [treeLocationsQuery.data?.items]);

  const branchIsExpanded = useCallback((id: string) => expandedIds.has(id), [expandedIds]);
  const onToggleBranch = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    const allIds = new Set((treeLocationsQuery.data?.items ?? []).map((l) => l.id));
    setExpandedIds(allIds);
  }, [treeLocationsQuery.data?.items]);

  const collapseAll = useCallback(() => {
    setExpandedIds(new Set());
  }, []);

  // For Drill-down view: chunked server pagination of direct children
  const currentParentId = trail[trail.length - 1]?.id ?? null;

  const listFilterKey = useMemo(() => {
    const search =
      (appliedFilters?.barcode ?? '').trim() ||
      (appliedFilters?.name ?? '').trim() ||
      undefined;
    const type = (appliedFilters?.locationType ?? '').trim() || undefined;
    return {
      warehouseId: warehouseId ?? '',
      parentId: currentParentId,
      search,
      type,
      includeArchived: INCLUDE_ARCHIVED_LOCATIONS,
    };
  }, [warehouseId, currentParentId, appliedFilters]);

  const fetchChunk = useCallback(
    (offset: number, limit: number) => {
      if (!warehouseId) {
        return Promise.resolve({ items: [], total: 0, limit, offset });
      }
      return LocationsApi.listChildren({
        warehouseId,
        parentId: currentParentId ?? undefined,
        offset,
        limit,
        search: listFilterKey.search,
        type: listFilterKey.type,
        includeArchived: INCLUDE_ARCHIVED_LOCATIONS,
      });
    },
    [warehouseId, currentParentId, listFilterKey.search, listFilterKey.type],
  );

  const pagination = useChunkedServerPagination<Location>({
    chunkSize: CHUNK_SIZE_STANDARD,
    filterKey: listFilterKey,
    fetchChunk,
    rtQueryKeyPrefix: QK.locations.all,
    chunkQueryKeyPrefix: 'locations-children-chunk',
    enabled: Boolean(warehouseId) && viewMode === 'drilldown',
  });

  const purgeCtx = useQuery({
    queryKey: warehouseId ? QK.locationsPurgeContext(warehouseId) : ['locations', 'purge-context', 'none'],
    queryFn: () => LocationsApi.purgeContext(warehouseId!),
    enabled: Boolean(warehouseId),
  });

  const blockDeleteSet = useMemo(() => {
    const s = new Set<string>();
    for (const id of purgeCtx.data?.locationIdsWithStock ?? []) s.add(id);
    for (const id of purgeCtx.data?.locationIdsOnAdjustments ?? []) s.add(id);
    return s;
  }, [purgeCtx.data]);

  const invalidateLocationQueries = useCallback(() => {
    if (!warehouseId) return;
    qc.invalidateQueries({ queryKey: QK.locations.all });
    qc.invalidateQueries({ queryKey: ['locations', 'lookup'] });
    qc.invalidateQueries({ queryKey: ['locations', 'warehouse-tree-all', warehouseId] });
    qc.invalidateQueries({ queryKey: ['warehouses', 'detail', warehouseId] });
    qc.invalidateQueries({ queryKey: QK.warehouses });
    qc.invalidateQueries({ queryKey: QK.locationsPurgeContext(warehouseId) });
    qc.invalidateQueries({ queryKey: QK.inventoryStock });
    qc.invalidateQueries({ queryKey: QK.inventoryStockByProduct });
  }, [qc, warehouseId]);

  const handleApplyFilters = () => {
    applyFilters();
    pagination.resetPage();
  };

  const handleResetFilters = () => {
    resetFilters();
    pagination.resetPage();
  };

  const navigateToCrumb = (index: number) => {
    setTrail((prev) => prev.slice(0, index + 1));
    pagination.resetPage();
  };

  const navigateInto = (row: Location) => {
    setTrail((prev) => [...prev, { id: row.id, name: row.name }]);
    pagination.resetPage();
  };

  const createMut = useMutation({
    mutationFn: LocationsApi.create,
    onSuccess: (loc) => {
      toast.success(
        t([`Location ${loc.barcode} created.`, `تم إنشاء الموقع ${loc.barcode}.`]),
      );
      invalidateLocationQueries();
      setOpenCreate(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof LocationsApi.update>[1] }) =>
      LocationsApi.update(id, patch),
    onSuccess: () => {
      toast.success(t(['Location updated.', 'تم تحديث الموقع.']));
      invalidateLocationQueries();
      setEditLoc(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const suspendLocMut = useMutation({
    mutationFn: (id: string) => LocationsApi.update(id, { status: 'blocked' }),
    onSuccess: () => {
      toast.success(
        t([
          'Location suspended — it cannot be used for inventory moves or tasks.',
          'تم إيقاف الموقع — لا يمكن استخدامه في حركات المخزون أو المهام.',
        ]),
      );
      invalidateLocationQueries();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const unsuspendLocMut = useMutation({
    mutationFn: (id: string) => LocationsApi.update(id, { status: 'active' }),
    onSuccess: () => {
      toast.success(t(['Location reactivated.', 'تم إعادة تفعيل الموقع.']));
      invalidateLocationQueries();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const permanentDeleteMut = useMutation({
    mutationFn: LocationsApi.permanentDelete,
    onSuccess: (res) => {
      toast.success(
        t(['Deleted {{n}} location(s).', 'تم حذف {{n}} موقع/مواقع.']).replace(
          '{{n}}',
          String(res.deletedIds.length),
        ),
      );
      invalidateLocationQueries();
      setPendingPermanentDelete(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const locActionBusy =
    suspendLocMut.isPending ||
    unsuspendLocMut.isPending ||
    permanentDeleteMut.isPending ||
    updateMut.isPending;

  // Handle warehouse loading or error state
  if (warehouseQuery.isLoading) {
    return (
      <AdminListPageShell
        icon="fa-location-dot"
        title={t(['Loading warehouse locations…', 'جاري تحميل مواقع المستودع…'])}
        isArabic={isArabic}
      >
        <div className="rounded-xl border border-border bg-surface-panel p-8 text-center text-text-muted">
          <i className="fa-solid fa-circle-notch fa-spin text-2xl text-brand-600 mb-2 block" />
          <p>{t(['Loading warehouse details…', 'جاري تحميل تفاصيل المستودع…'])}</p>
        </div>
      </AdminListPageShell>
    );
  }

  if (warehouseQuery.isError || !warehouse) {
    return (
      <AdminListPageShell
        icon="fa-location-dot"
        title={t(['Warehouse Not Found', 'المستودع غير موجود'])}
        isArabic={isArabic}
      >
        <Card className="p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-status-danger-bg text-status-danger-fg">
            <i className="fa-solid fa-triangle-exclamation text-2xl" />
          </div>
          <h2 className="text-lg font-bold text-text-strong">
            {t(['Warehouse does not exist or cannot be accessed.', 'المستودع غير موجود أو لا يمكنك الوصول إليه.'])}
          </h2>
          <p className="mt-1 text-sm text-text-muted">
            {t([
              'The requested warehouse could not be loaded. Please return to the warehouse overview.',
              'تعذّر تحميل المستودع المطلوب. يرجى العودة إلى قائمة المستودعات.',
            ])}
          </p>
          <div className="mt-6 flex justify-center">
            <Button variant="brand" onClick={() => navigate('/locations')}>
              <i className="fa-solid fa-arrow-left me-2" />
              {t(['Back to Warehouses', 'العودة إلى المستودعات'])}
            </Button>
          </div>
        </Card>
      </AdminListPageShell>
    );
  }

  return (
    <AdminListPageShell
      icon="fa-location-dot"
      title={
        <div className="flex flex-wrap items-center gap-2.5">
          <span>{warehouse.name}</span>
          <span className="font-mono text-sm font-semibold text-text-muted">({warehouse.code})</span>
          <Badge tone={warehouse.status === 'active' ? 'success' : 'neutral'} size="xs">
            {warehouse.status}
          </Badge>
        </div>
      }
      subtitle={
        <div className="flex flex-wrap items-center gap-2 text-sm text-text-muted">
          <span>{warehouse.address || warehouse.city || t(['Main Warehouse', 'المستودع الرئيسي'])}</span>
          <span>·</span>
          <span>
            {t(['{{n}} location(s)', '{{n}} موقع/مواقع']).replace(
              '{{n}}',
              String(treeLocationsQuery.data?.total ?? warehouse.locationCount ?? 0),
            )}
          </span>
        </div>
      }
      isArabic={isArabic}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Link to="/locations">
            <Button variant="secondary" size="md">
              <i className="fa-solid fa-arrow-left me-1.5 rtl:rotate-180" />
              {t(['Warehouses Overview', 'نظرة عامة على المستودعات'])}
            </Button>
          </Link>
          <Button variant="brand" onClick={() => setOpenCreate(true)}>
            <i className="fa-solid fa-plus me-1.5" />
            {t(['+ New location', '+ موقع جديد'])}
          </Button>
        </div>
      }
    >
      {/* Breadcrumb path navigation */}
      <nav
        aria-label={t(['Location hierarchy navigation', 'التنقل في تسلسل المواقع'])}
        className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle pb-3 text-sm"
      >
        <div className="flex flex-wrap items-center gap-1.5">
          <Link
            to="/locations"
            className="inline-flex items-center gap-1 font-medium text-brand-600 hover:underline dark:text-brand-400"
          >
            <i className="fa-solid fa-warehouse text-xs" />
            <span>{t(['Warehouses', 'المستودعات'])}</span>
          </Link>
          <span className="text-text-faint">/</span>
          <span className="font-semibold text-text-strong">
            {warehouse.code} ({warehouse.name})
          </span>
          {viewMode === 'drilldown' && trail.length > 1 ? (
            trail.slice(1).map((crumb, idx) => (
              <span key={crumb.id ?? idx} className="inline-flex items-center gap-1.5">
                <span className="text-text-faint">/</span>
                {idx < trail.length - 2 ? (
                  <button
                    type="button"
                    className="font-medium text-brand-600 hover:underline dark:text-brand-400"
                    onClick={() => navigateToCrumb(idx + 1)}
                  >
                    {crumb.name}
                  </button>
                ) : (
                  <span className="font-semibold text-text-strong">{crumb.name}</span>
                )}
              </span>
            ))
          ) : null}
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center gap-1 rounded-lg border border-border bg-surface-card-muted p-0.5 text-xs">
          <button
            type="button"
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition ${
              viewMode === 'tree'
                ? 'bg-surface-panel text-brand-600 shadow-sm dark:text-brand-400'
                : 'text-text-muted hover:text-text-body'
            }`}
            onClick={() => setViewMode('tree')}
          >
            <i className="fa-solid fa-folder-tree" />
            <span>{t(['Hierarchy Tree', 'شجرة التسلسل'])}</span>
          </button>
          <button
            type="button"
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition ${
              viewMode === 'drilldown'
                ? 'bg-surface-panel text-brand-600 shadow-sm dark:text-brand-400'
                : 'text-text-muted hover:text-text-body'
            }`}
            onClick={() => setViewMode('drilldown')}
          >
            <i className="fa-solid fa-table-cells" />
            <span>{t(['Drill-down Table', 'جدول التفصيل'])}</span>
          </button>
        </div>
      </nav>

      {/* Filters */}
      <FilterPanel
        title={t(['Location filters', 'فلاتر المواقع'])}
        onApply={handleApplyFilters}
        onReset={handleResetFilters}
        loading={viewMode === 'tree' ? treeLocationsQuery.isFetching : pagination.isFetching}
        applyLabel={t(['Apply filters', 'تطبيق الفلاتر'])}
        resetLabel={t(['Reset', 'إعادة تعيين'])}
        compact={
          <TextField
            label={t(['Location name', 'اسم الموقع'])}
            value={draftFilters?.name ?? ''}
            onChange={(e) => setDraft({ name: e.target.value })}
            placeholder={t(['Contains…', 'يحتوي…'])}
          />
        }
        activeCount={
          [draftFilters?.name, draftFilters?.barcode, draftFilters?.locationType].filter((v) =>
            Boolean(v && String(v).trim()),
          ).length
        }
        advancedLabel={t(['Advanced Filtering', 'تصفية متقدمة'])}
        collapseLabel={t(['Collapsed', 'إخفاء'])}
      >
        <TextField
          label={t(['Location name', 'اسم الموقع'])}
          value={draftFilters?.name ?? ''}
          onChange={(e) => setDraft({ name: e.target.value })}
          placeholder={t(['Contains…', 'يحتوي…'])}
        />
        <TextField
          label="Barcode"
          value={draftFilters?.barcode ?? ''}
          onChange={(e) => setDraft({ barcode: e.target.value })}
          placeholder={t(['Contains…', 'يحتوي…'])}
          className="font-mono"
        />
        <FilterScanButton
          label={t(['Scan barcode', 'مسح Barcode'])}
          onClick={() => setScanOpen(true)}
          title={t(['Scan a barcode with the device camera', 'مسح Barcode بالكاميرا'])}
          ariaLabel={t(['Scan barcode', 'مسح Barcode'])}
        />
        <SelectField
          label={t(['Location type', 'نوع الموقع'])}
          name="locationTypeFilter"
          value={draftFilters?.locationType ?? ''}
          onChange={(e) => setDraft({ locationType: e.target.value })}
          options={[
            { value: '', label: t(['All types', 'كل الأنواع']) },
            ...localizedLocationTypeSelectOptions(t),
          ]}
        />
      </FilterPanel>

      {/* Tree view expand/collapse actions */}
      {viewMode === 'tree' ? (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={expandAll}
              className="font-medium text-brand-600 hover:underline dark:text-brand-400"
            >
              <i className="fa-solid fa-angles-down me-1" />
              {t(['Expand all branches', 'توسيع كل الفروع'])}
            </button>
            <span className="text-text-faint">·</span>
            <button
              type="button"
              onClick={collapseAll}
              className="font-medium text-brand-600 hover:underline dark:text-brand-400"
            >
              <i className="fa-solid fa-angles-up me-1" />
              {t(['Collapse all', 'طي الكل'])}
            </button>
          </div>
          <span className="text-text-muted">
            {t(['Showing hierarchy for warehouse {{code}}', 'عرض التسلسل لمستودع {{code}}']).replace('{{code}}', warehouse.code)}
          </span>
        </div>
      ) : null}

      {/* Main Content: Tree View or Drill-down Table */}
      {viewMode === 'tree' ? (
        treeLocationsQuery.isLoading ? (
          <div className="rounded-xl border border-border bg-surface-panel p-8 text-center text-text-muted">
            <i className="fa-solid fa-circle-notch fa-spin text-2xl text-brand-600 mb-2 block" />
            <p>{t(['Loading location hierarchy…', 'جاري تحميل شجرة المواقع…'])}</p>
          </div>
        ) : treeData.roots.length === 0 ? (
          <Card className="p-8 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-surface-sunken text-text-muted">
              <i className="fa-solid fa-location-dot text-xl" />
            </div>
            <h3 className="font-semibold text-text-strong">
              {t(['No locations found in this warehouse', 'لا توجد مواقع في هذا المستودع'])}
            </h3>
            <p className="mt-1 text-sm text-text-muted">
              {t([
                'Start by creating a root-level location such as an aisle or receiving area.',
                'ابدأ بإنشاء موقع جذري مثل ممر أو منطقة استلام.',
              ])}
            </p>
            <div className="mt-4">
              <Button variant="brand" onClick={() => setOpenCreate(true)}>
                <i className="fa-solid fa-plus me-1.5" />
                {t(['+ New location', '+ موقع جديد'])}
              </Button>
            </div>
          </Card>
        ) : (
          <LocationsTreeTable
            roots={treeData.roots}
            flatList={treeLocationsQuery.data?.items ?? []}
            purgeReady={Boolean(purgeCtx.data)}
            blockDeleteSet={blockDeleteSet}
            branchIsExpanded={branchIsExpanded}
            onToggleBranch={onToggleBranch}
            resolve={treeData.resolve}
            onEdit={setEditLoc}
            onBarcodeClick={(barcode, contextLabel) => setBarcodeModal({ value: barcode, contextLabel })}
            onStockTypeClick={(node) => {
              const full = treeData.resolve(node.id);
              if (full) setStockModal(full);
            }}
            actionBusy={locActionBusy}
            onSuspend={(id) => suspendLocMut.mutate(id)}
            onUnsuspend={(id) => unsuspendLocMut.mutate(id)}
            onRequestPermanentDelete={(id, fullPath, subtreeSize) =>
              setPendingPermanentDelete({ id, fullPath, subtreeSize })
            }
          />
        )
      ) : (
        <LocationsDrillDownTable
          rows={pagination.rows}
          loading={pagination.isFetching}
          serverPagination={pagination.serverPagination}
          purgeReady={Boolean(purgeCtx.data)}
          blockDeleteSet={blockDeleteSet}
          onNavigateInto={navigateInto}
          onEdit={setEditLoc}
          onBarcodeClick={(barcode, contextLabel) => setBarcodeModal({ value: barcode, contextLabel })}
          onStockClick={setStockModal}
          onSuspend={(id) => suspendLocMut.mutate(id)}
          onUnsuspend={(id) => unsuspendLocMut.mutate(id)}
          onRequestPermanentDelete={(row) =>
            setPendingPermanentDelete({ id: row.id, fullPath: row.fullPath })
          }
          actionBusy={locActionBusy}
        />
      )}

      {/* Modals */}
      <BarcodeScanModal
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onScan={(scanned) => {
          setDraft({ barcode: scanned });
          setScanOpen(false);
          toast.success(
            t(['Barcode scanned. Apply filters to search.', 'تم مسح Barcode. طبّق الفلتر للبحث.']),
          );
        }}
      />

      <BarcodeImageModal
        open={Boolean(barcodeModal)}
        onClose={() => setBarcodeModal(null)}
        value={barcodeModal?.value ?? ''}
        contextLabel={barcodeModal?.contextLabel}
      />

      <StockModal
        open={Boolean(stockModal)}
        location={stockModal}
        warehouseId={warehouseId!}
        onClose={() => setStockModal(null)}
      />

      <CreateLocationModal
        open={openCreate}
        onClose={() => setOpenCreate(false)}
        loading={createMut.isPending}
        warehouseId={warehouseId!}
        defaultParentId={currentParentId}
        onSubmit={(input) => createMut.mutate(input)}
      />

      <EditLocationModal
        open={Boolean(editLoc)}
        location={editLoc}
        loading={updateMut.isPending}
        onClose={() => setEditLoc(null)}
        onSubmit={(patch) => {
          if (editLoc) updateMut.mutate({ id: editLoc.id, patch });
        }}
      />

      <ConfirmModal
        open={Boolean(pendingPermanentDelete)}
        onClose={() => setPendingPermanentDelete(null)}
        onConfirm={() => {
          if (pendingPermanentDelete) permanentDeleteMut.mutate(pendingPermanentDelete.id);
        }}
        loading={permanentDeleteMut.isPending}
        title={t(['Delete location permanently', 'حذف الموقع نهائياً'])}
        confirmLabel={t(['Delete permanently', 'حذف نهائي'])}
        danger
      >
        <p className="text-sm text-text-body">
          {pendingPermanentDelete?.subtreeSize && pendingPermanentDelete.subtreeSize > 1
            ? t([
                'This will permanently delete {{path}} and all its {{count}} nested sub-locations. This cannot be undone.',
                'سيؤدي هذا إلى حذف {{path}} وجميع المواقع الفرعية التابعة له ({{count}} موقع) نهائياً. لا يمكن التراجع عن هذا الإجراء.',
              ])
                .replace('{{path}}', pendingPermanentDelete.fullPath)
                .replace('{{count}}', String(pendingPermanentDelete.subtreeSize))
            : t([
                'Are you sure you want to permanently delete location {{path}}? This action cannot be undone.',
                'هل أنت متأكد من حذف الموقع {{path}} نهائياً؟ لا يمكن التراجع عن هذا الإجراء.',
              ]).replace('{{path}}', pendingPermanentDelete?.fullPath ?? '')}
        </p>
      </ConfirmModal>
    </AdminListPageShell>
  );
}

function StockModal({
  open,
  location,
  warehouseId,
  onClose,
}: {
  open: boolean;
  location: Location | null;
  warehouseId: string;
  onClose: () => void;
}) {
  const { t } = useWmsTranslation();
  const stock = useQuery({
    queryKey:
      location && warehouseId
        ? QK.inventoryStockByLocation(location.id, warehouseId)
        : ['inventory', 'stock', 'location', 'none'],
    queryFn: () =>
      InventoryApi.stock({
        locationId: location!.id,
        warehouseId,
        limit: 500,
      }),
    enabled: open && Boolean(location) && Boolean(warehouseId),
  });

  const rows = stock.data?.items ?? [];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        location
          ? `${t(['Stock', 'المخزون'])} · ${location.fullPath}`
          : t(['Stock', 'المخزون'])
      }
      widthClass="max-w-3xl"
      footer={
        <Button type="button" variant="danger" onClick={onClose}>
          {t(['Close', 'إغلاق'])}
        </Button>
      }
    >
      {!location || !warehouseId ? (
        <p className="text-sm text-text-muted">
          {t(['Missing warehouse or location.', 'المستودع أو الموقع غير متوفر.'])}
        </p>
      ) : stock.isLoading ? (
        <p className="text-sm text-text-muted">{t(['Loading stock…', 'جاري تحميل المخزون…'])}</p>
      ) : stock.isError ? (
        <p className="text-sm text-status-danger-fg">
          {(stock.error as Error)?.message ?? t(['Could not load stock.', 'تعذّر تحميل المخزون.'])}
        </p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-text-body">
          {t(['No stock rows at this location.', 'لا توجد صفوف مخزون في هذا الموقع.'])}
        </p>
      ) : (
        <div className="max-h-[min(60vh,28rem)] overflow-auto rounded border border-border">
          <table className="w-full min-w-[28rem] border-collapse text-left text-sm">
            <thead className="sticky top-0 bg-surface-card-muted text-xs font-semibold uppercase tracking-wide text-text-muted">
              <tr>
                <th className="border-b border-border px-3 py-2">{t(['Product', 'المنتج'])}</th>
                <th className="border-b border-border px-3 py-2">SKU</th>
                <th className="border-b border-border px-3 py-2">Lot</th>
                <th className="border-b border-border px-3 py-2 text-right">
                  {t(['Available', 'المتوفر'])}
                </th>
                <th className="border-b border-border px-3 py-2 text-right">
                  {t(['On hand', 'في المخزون'])}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r: StockRow) => (
                <tr key={r.id} className="border-b border-border-subtle last:border-0 hover:bg-surface-hover">
                  <td className="px-3 py-2 text-text-strong">{r.product.name}</td>
                  <td className="px-3 py-2 font-mono text-xs text-text-body">{r.product.sku}</td>
                  <td className="px-3 py-2 font-mono text-xs text-text-muted">{r.lot?.lotNumber ?? '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-text-body">
                    {fmtQty(r.quantityAvailable)} <span className="text-text-muted">{r.product.uom}</span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-text-body">
                    {fmtQty(r.quantityOnHand)} <span className="text-text-muted">{r.product.uom}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}

interface CreateLocationModalProps {
  open: boolean;
  onClose: () => void;
  loading: boolean;
  warehouseId: string;
  defaultParentId: string | null;
  onSubmit: (input: CreateLocationInput) => void;
}

function CreateLocationModal({
  open,
  onClose,
  loading,
  warehouseId,
  defaultParentId,
  onSubmit,
}: CreateLocationModalProps) {
  const { t } = useWmsTranslation();
  const typeOptions = useMemo(() => localizedLocationTypeSelectOptions(t), [t]);
  const [name, setName] = useState('');
  const [type, setType] = useState<LocationType>('internal');
  const [parentId, setParentId] = useState('');
  const [barcode, setBarcode] = useState('');
  const [maxWeightKg, setMaxWeightKg] = useState('');
  const [maxCbm, setMaxCbm] = useState('');

  useEffect(() => {
    if (open) {
      setParentId(defaultParentId ?? '');
    }
  }, [open, defaultParentId]);

  const reset = () => {
    setName('');
    setType('internal');
    setParentId(defaultParentId ?? '');
    setBarcode('');
    setMaxWeightKg('');
    setMaxCbm('');
  };

  const handleClose = () => {
    if (!loading) {
      reset();
      onClose();
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const cap = locationTypeSupportsCapacityFields(type);
    onSubmit({
      warehouseId,
      parentId: parentId || undefined,
      name,
      type,
      barcode: barcode.trim() || undefined,
      maxWeightKg: cap ? parseOptionalPositiveDecimal(maxWeightKg) : undefined,
      maxCbm: cap ? parseOptionalPositiveDecimal(maxCbm) : undefined,
    });
  };

  const typeHint = localizedLocationTypeHint(type, t);

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={t(['New location', 'موقع جديد'])}
      footer={
        <>
          <Button
            type="button"
            variant="danger"
            className={MODAL_CANCEL_BUTTON_CLASS}
            onClick={handleClose}
            disabled={loading}
          >
            {t(['Cancel', 'إلغاء'])}
          </Button>
          <Button form="create-loc" type="submit" variant="brand" loading={loading}>
            {t(['Create', 'إنشاء'])}
          </Button>
        </>
      }
    >
      <form id="create-loc" onSubmit={submit} className="space-y-3 pb-2">
        <LocationParentPicker warehouseId={warehouseId} value={parentId} onChange={setParentId} />
        <TextField
          label={t(['Name', 'الاسم'])}
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t(['e.g. Shelf A, Bin 01', 'مثال: رف أ، صندوق 01'])}
        />
        <SelectField
          label={t(['Type', 'النوع'])}
          name="createLocType"
          value={type}
          onChange={(e) => setType(e.target.value as LocationType)}
          options={typeOptions.map((o) => ({ value: o.value, label: o.label }))}
        />
        {typeHint ? <p className="text-xs text-text-muted">{typeHint}</p> : null}
        <TextField
          label="Barcode"
          value={barcode}
          onChange={(e) => setBarcode(e.target.value)}
          className="font-mono"
          hint={t(['Leave empty to auto-generate a barcode.', 'اتركه فارغاً لإنشاء Barcode تلقائياً.'])}
        />
        {locationTypeSupportsCapacityFields(type) ? (
          <>
            <TextField
              label={t(['Max weight (kg, optional)', 'الوزن الأقصى (كغ، اختياري)'])}
              value={maxWeightKg}
              onChange={(e) => setMaxWeightKg(e.target.value)}
              inputMode="decimal"
            />
            <TextField
              label={t(['Max volume (CBM, optional)', 'الحجم الأقصى (CBM، اختياري)'])}
              hint={t([
                'Cubic meters — overall size limit for this bin.',
                'متر مكعب — حد الحجم الإجمالي لهذا Bin.',
              ])}
              value={maxCbm}
              onChange={(e) => setMaxCbm(e.target.value)}
              inputMode="decimal"
            />
          </>
        ) : null}
      </form>
    </Modal>
  );
}

function EditLocationModal({
  open,
  location,
  loading,
  onClose,
  onSubmit,
}: {
  open: boolean;
  location: Location | null;
  loading: boolean;
  onClose: () => void;
  onSubmit: (patch: Parameters<typeof LocationsApi.update>[1]) => void;
}) {
  const { t } = useWmsTranslation();
  const [name, setName] = useState('');
  const [type, setType] = useState<LocationType>('internal');
  const [barcode, setBarcode] = useState('');
  const [maxWeightKg, setMaxWeightKg] = useState('');
  const [maxCbm, setMaxCbm] = useState('');

  useEffect(() => {
    if (location) {
      setName(location.name);
      setType((location.type === 'qc' ? 'quarantine' : location.type) as LocationType);
      setBarcode(location.barcode);
      setMaxWeightKg(
        location.maxWeightKg != null && location.maxWeightKg !== '' ? String(location.maxWeightKg) : '',
      );
      setMaxCbm(location.maxCbm != null && location.maxCbm !== '' ? String(location.maxCbm) : '');
    }
  }, [location]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const cap = locationTypeSupportsCapacityFields(type);
    const w = cap ? parseOptionalPositiveDecimal(maxWeightKg) : undefined;
    const v = cap ? parseOptionalPositiveDecimal(maxCbm) : undefined;
    onSubmit({
      name,
      type,
      barcode: barcode.trim(),
      ...(cap ? { maxWeightKg: w, maxCbm: v } : {}),
    });
  };

  if (!location) return null;

  const typeOptions = localizedManagedTypeOptionsForEdit(location.type, t);
  const typeHint = localizedLocationTypeHint(type, t);

  return (
    <Modal
      open={open}
      onClose={() => !loading && onClose()}
      title={`${t(['Edit', 'تعديل'])} ${location.fullPath}`}
      footer={
        <>
          <Button
            type="button"
            variant="danger"
            className={MODAL_CANCEL_BUTTON_CLASS}
            onClick={onClose}
            disabled={loading}
          >
            {t(['Cancel', 'إلغاء'])}
          </Button>
          <Button type="submit" form="edit-loc" variant="brand" loading={loading}>
            {t(['Save', 'حفظ'])}
          </Button>
        </>
      }
    >
      <form id="edit-loc" onSubmit={submit} className="space-y-3 pb-2">
        <TextField
          label={t(['Name', 'الاسم'])}
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <SelectField
          label={t(['Type', 'النوع'])}
          name="editLocType"
          value={type}
          onChange={(e) => setType(e.target.value as LocationType)}
          options={typeOptions.map((o) => ({ value: o.value, label: o.label }))}
        />
        {typeHint ? <p className="text-xs text-text-muted">{typeHint}</p> : null}
        <TextField label="Barcode" required value={barcode} onChange={(e) => setBarcode(e.target.value)} />
        {locationTypeSupportsCapacityFields(type) ? (
          <>
            <TextField
              label={t(['Max weight (kg, optional)', 'الوزن الأقصى (كغ، اختياري)'])}
              value={maxWeightKg}
              onChange={(e) => setMaxWeightKg(e.target.value)}
              inputMode="decimal"
            />
            <TextField
              label={t(['Max volume (CBM, optional)', 'الحجم الأقصى (CBM، اختياري)'])}
              value={maxCbm}
              onChange={(e) => setMaxCbm(e.target.value)}
              inputMode="decimal"
            />
          </>
        ) : null}
      </form>
    </Modal>
  );
}

export default WarehouseLocationsPage;
