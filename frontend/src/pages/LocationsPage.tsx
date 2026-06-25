import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

import { InventoryApi, StockRow } from '../api/inventory';
import { CreateLocationInput, Location, LocationsApi, LocationType } from '../api/locations';
import { BarcodeImageModal } from '../components/BarcodeImageModal';
import { BarcodeScanIcon } from '../components/BarcodeScanIcon';
import { BarcodeScanModal } from '../components/BarcodeScanModal';
import { Button } from '../components/Button';
import { FilterPanel } from '../components/FilterPanel';
import { LocationParentPicker } from '../components/locations/LocationParentPicker';
import { LocationsDrillDownTable } from '../components/locations/LocationsDrillDownTable';
import { Modal } from '../components/Modal';
import { PageHeader } from '../components/PageHeader';
import { SelectField } from '../components/SelectField';
import { TextField } from '../components/TextField';
import { useToast } from '../components/ToastProvider';
import { QK } from '../constants/query-keys';
import { useDefaultWarehouseId } from '../hooks/useDefaultWarehouse';
import {
  CHUNK_SIZE_STANDARD,
  useChunkedServerPagination,
} from '../hooks/useChunkedServerPagination';
import { MODAL_CANCEL_BUTTON_CLASS } from '../lib/modal-button-styles';
import { useFilters } from '../hooks/useFilters';
import { locationTypeSupportsCapacityFields } from '../lib/location-types';
import {
  localizedLocationTypeHint,
  localizedLocationTypeSelectOptions,
  localizedManagedTypeOptionsForEdit,
} from '../lib/ui-labels/locations';
import { useWmsTranslation } from '../lib/ui-i18n';

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

export function LocationsPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const { t } = useWmsTranslation();
  const { warehouseId } = useDefaultWarehouseId();
  const initialLocFilters = useMemo<LocationDraftFilters>(
    () => ({ name: '', barcode: '', locationType: '' }),
    [],
  );
  const { draftFilters, appliedFilters, setDraft, applyFilters, applyPatch, resetFilters } =
    useFilters(initialLocFilters);

  const [trail, setTrail] = useState<BreadcrumbCrumb[]>([{ id: null, name: 'root' }]);
  const [open, setOpen] = useState(false);
  const [editLoc, setEditLoc] = useState<Location | null>(null);
  const [barcodeModal, setBarcodeModal] = useState<{ value: string; contextLabel: string } | null>(null);
  const [stockModal, setStockModal] = useState<Location | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [pendingPermanentDelete, setPendingPermanentDelete] = useState<Location | null>(null);

  const currentParentId = trail[trail.length - 1]?.id ?? null;

  const listFilterKey = useMemo(() => {
    const search =
      appliedFilters.barcode.trim() ||
      appliedFilters.name.trim() ||
      undefined;
    return {
      warehouseId: warehouseId ?? '',
      parentId: currentParentId,
      search,
      type: appliedFilters.locationType.trim() || undefined,
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
    enabled: !!warehouseId,
  });

  const purgeCtx = useQuery({
    queryKey: warehouseId ? QK.locationsPurgeContext(warehouseId) : ['locations', 'purge-context', 'none'],
    queryFn: () => LocationsApi.purgeContext(warehouseId!),
    enabled: !!warehouseId,
  });

  const blockDeleteSet = useMemo(() => {
    const s = new Set<string>();
    for (const id of purgeCtx.data?.locationIdsWithStock ?? []) s.add(id);
    for (const id of purgeCtx.data?.locationIdsOnAdjustments ?? []) s.add(id);
    return s;
  }, [purgeCtx.data]);

  const invalidateLocationQueries = () => {
    if (!warehouseId) return;
    qc.invalidateQueries({ queryKey: QK.locations.all });
    qc.invalidateQueries({ queryKey: ['locations', 'lookup'] });
    qc.invalidateQueries({ queryKey: QK.locationsPurgeContext(warehouseId) });
    qc.invalidateQueries({ queryKey: QK.inventoryStock });
    qc.invalidateQueries({ queryKey: QK.inventoryStockByProduct });
  };

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
      toast.success(`Location ${loc.barcode} created.`);
      invalidateLocationQueries();
      setOpen(false);
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

  return (
    <>
      <PageHeader
        title={t(['Locations', 'المواقع التخزينية'])}
        actions={
          <Button variant="brand" disabled={!warehouseId} onClick={() => setOpen(true)}>
            {t(['+ New location', '+ موقع جديد'])}
          </Button>
        }
      />

      <nav
        aria-label={t(['Location hierarchy', 'تسلسل المواقع'])}
        className="mb-3 flex flex-wrap items-center gap-1 text-sm"
      >
        {trail.map((crumb, idx) => {
          const displayName =
            crumb.id === null ? t(['Locations', 'المواقع التخزينية']) : crumb.name;
          return (
          <span key={crumb.id ?? 'root'} className="inline-flex items-center gap-1">
            {idx > 0 ? <span className="text-slate-400">/</span> : null}
            {idx < trail.length - 1 ? (
              <button
                type="button"
                className="font-medium text-[#1a7a44] hover:underline"
                onClick={() => navigateToCrumb(idx)}
              >
                {displayName}
              </button>
            ) : (
              <span className="font-semibold text-slate-800">{displayName}</span>
            )}
          </span>
          );
        })}
      </nav>

      <FilterPanel
        title={t(['Location filters', 'فلاتر المواقع'])}
        onApply={handleApplyFilters}
        onReset={handleResetFilters}
        loading={pagination.isFetching}
        applyLabel={t(['Apply filters', 'تطبيق الفلاتر'])}
        resetLabel={t(['Reset', 'إعادة تعيين'])}
      >
        <div className="flex min-w-0 flex-wrap items-end gap-3">
          <TextField
            label={t(['Location name', 'اسم الموقع'])}
            value={draftFilters.name}
            onChange={(e) => setDraft({ name: e.target.value })}
            placeholder={t(['Contains…', 'يحتوي…'])}
            className="min-w-[12.5rem] flex-1 basis-40"
          />
          <TextField
            label="Barcode"
            value={draftFilters.barcode}
            onChange={(e) => setDraft({ barcode: e.target.value })}
            placeholder={t(['Contains…', 'يحتوي…'])}
            className="min-w-[10rem] flex-1 basis-32 font-mono"
          />
          <Button
            type="button"
            variant="secondary"
            className="h-[34px] shrink-0 px-2.5"
            title={t(['Scan a barcode with the device camera', 'مسح Barcode بالكاميرا'])}
            aria-label={t(['Scan barcode', 'مسح Barcode'])}
            onClick={() => setScanOpen(true)}
          >
            <BarcodeScanIcon className="h-5 w-5" />
          </Button>
          <div className="min-w-[11rem] max-w-[14rem] shrink-0">
            <SelectField
              label={t(['Location type', 'نوع الموقع'])}
              name="locationTypeFilter"
              value={draftFilters.locationType}
              onChange={(e) => setDraft({ locationType: e.target.value })}
              options={[
                { value: '', label: t(['All types', 'كل الأنواع']) },
                ...localizedLocationTypeSelectOptions(t).map((o) => ({
                  value: o.value,
                  label: o.label,
                })),
              ]}
            />
          </div>
        </div>
      </FilterPanel>

      {!warehouseId ? (
        <p className="rounded-xl border border-slate-100 bg-white p-4 text-sm text-slate-500 shadow-sm">
          {t(['Default warehouse required to load locations.', 'يلزم مستودع افتراضي لتحميل المواقع.'])}
        </p>
      ) : (
        <LocationsDrillDownTable
          rows={pagination.rows}
          loading={pagination.isInitialLoading}
          serverPagination={pagination.serverPagination}
          purgeReady={purgeCtx.isSuccess}
          blockDeleteSet={blockDeleteSet}
          onNavigateInto={navigateInto}
          onEdit={(loc) => setEditLoc(loc)}
          onBarcodeClick={(barcode, contextLabel) => setBarcodeModal({ value: barcode, contextLabel })}
          onStockClick={(loc) => setStockModal(loc)}
          actionBusy={locActionBusy}
          onSuspend={(id) => suspendLocMut.mutate(id)}
          onUnsuspend={(id) => unsuspendLocMut.mutate(id)}
          onRequestPermanentDelete={(row) => setPendingPermanentDelete(row)}
        />
      )}

      <BarcodeImageModal
        open={!!barcodeModal}
        onClose={() => setBarcodeModal(null)}
        value={barcodeModal?.value ?? ''}
        contextLabel={barcodeModal?.contextLabel}
      />

      <LocationStockModal
        open={!!stockModal}
        location={stockModal}
        warehouseId={warehouseId}
        onClose={() => setStockModal(null)}
      />

      <CreateLocationModal
        open={open}
        onClose={() => setOpen(false)}
        loading={createMut.isPending}
        warehouseId={warehouseId}
        defaultParentId={currentParentId}
        onSubmit={(input) => createMut.mutate(input)}
      />

      <EditLocationModal
        open={!!editLoc}
        location={editLoc}
        loading={updateMut.isPending}
        onClose={() => setEditLoc(null)}
        onSubmit={(patch) => editLoc && updateMut.mutate({ id: editLoc.id, patch })}
      />

      <Modal
        open={!!pendingPermanentDelete}
        onClose={() => !permanentDeleteMut.isPending && setPendingPermanentDelete(null)}
        title={t(['Delete location subtree?', 'حذف شجرة المواقع؟'])}
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => !permanentDeleteMut.isPending && setPendingPermanentDelete(null)}
              disabled={permanentDeleteMut.isPending}
            >
              {t(['Cancel', 'إلغاء'])}
            </Button>
            <Button
              variant="danger"
              loading={permanentDeleteMut.isPending}
              onClick={() => {
                if (pendingPermanentDelete) permanentDeleteMut.mutate(pendingPermanentDelete.id);
              }}
            >
              {t(['Delete permanently', 'حذف نهائي'])}
            </Button>
          </>
        }
      >
        {pendingPermanentDelete ? (
          <>
            <p>
              {t([
                'This will permanently remove',
                'سيُزال نهائياً',
              ])}{' '}
              <strong>{pendingPermanentDelete.fullPath}</strong>
              {pendingPermanentDelete.childCount != null && pendingPermanentDelete.childCount > 0 ? (
                <>
                  {t([', its', '، مع'])}{' '}
                  <strong>{pendingPermanentDelete.childCount.toLocaleString()}</strong>{' '}
                  {t([
                    'direct child location(s), and any nested descendants',
                    'موقع/مواقع فرعية مباشرة وأي أحفاد متداخلين',
                  ])}
                </>
              ) : (
                <> {t(['and any nested descendants', 'وأي أحفاد متداخلين'])}</>
              )}
              .{' '}
              {t([
                'Stock rows must be empty and adjustment lines must not reference these locations.',
                'يجب أن تكون صفوف المخزون فارغة وألا تشير بنود التعديل إلى هذه المواقع.',
              ])}
            </p>
            <p className="mt-2">{t(['This cannot be undone.', 'لا يمكن التراجع عن هذا الإجراء.'])}</p>
          </>
        ) : null}
      </Modal>

      <BarcodeScanModal
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onScan={(text) => {
          applyPatch({ barcode: text.trim() });
          toast.success(
            t(['Barcode scanned — barcode filter updated.', 'تم مسح Barcode — تم تحديث فلتر Barcode.']),
          );
        }}
        onCameraError={(msg) => toast.error(msg)}
      />
    </>
  );
}

function LocationStockModal({
  open,
  onClose,
  warehouseId,
  location,
}: {
  open: boolean;
  onClose: () => void;
  warehouseId: string | undefined;
  location: Location | null;
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
        warehouseId: warehouseId!,
        limit: 500,
      }),
    enabled: open && !!location && !!warehouseId,
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
        <Button type="button" variant="secondary" onClick={onClose}>
          {t(['Close', 'إغلاق'])}
        </Button>
      }
    >
      {!location || !warehouseId ? (
        <p className="text-sm text-slate-500">
          {t(['Missing warehouse or location.', 'المستودع أو الموقع غير متوفر.'])}
        </p>
      ) : stock.isLoading ? (
        <p className="text-sm text-slate-500">{t(['Loading stock…', 'جاري تحميل المخزون…'])}</p>
      ) : stock.isError ? (
        <p className="text-sm text-rose-600">
          {(stock.error as Error)?.message ?? t(['Could not load stock.', 'تعذّر تحميل المخزون.'])}
        </p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-600">
          {t(['No stock rows at this location.', 'لا توجد صفوف مخزون في هذا الموقع.'])}
        </p>
      ) : (
        <div className="max-h-[min(60vh,28rem)] overflow-auto rounded border border-slate-200">
          <table className="w-full min-w-[28rem] border-collapse text-left text-sm">
            <thead className="sticky top-0 bg-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-600">
              <tr>
                <th className="border-b border-slate-200 px-3 py-2">{t(['Product', 'المنتج'])}</th>
                <th className="border-b border-slate-200 px-3 py-2">SKU</th>
                <th className="border-b border-slate-200 px-3 py-2">Lot</th>
                <th className="border-b border-slate-200 px-3 py-2 text-right">
                  {t(['Available', 'المتوفر'])}
                </th>
                <th className="border-b border-slate-200 px-3 py-2 text-right">
                  {t(['On hand', 'في المخزون'])}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r: StockRow) => (
                <tr key={r.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/80">
                  <td className="px-3 py-2 text-slate-900">{r.product.name}</td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-700">{r.product.sku}</td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-600">{r.lot?.lotNumber ?? '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-800">
                    {fmtQty(r.quantityAvailable)} <span className="text-slate-500">{r.product.uom}</span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-800">
                    {fmtQty(r.quantityOnHand)} <span className="text-slate-500">{r.product.uom}</span>
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
    if (open) setParentId(defaultParentId ?? '');
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
        />
        <SelectField
          label={t(['Type', 'النوع'])}
          name="createLocType"
          value={type}
          onChange={(e) => setType(e.target.value as LocationType)}
          options={typeOptions.map((o) => ({ value: o.value, label: o.label }))}
        />
        {typeHint ? <p className="text-xs text-slate-600">{typeHint}</p> : null}
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
        {typeHint ? <p className="text-xs text-slate-600">{typeHint}</p> : null}
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
