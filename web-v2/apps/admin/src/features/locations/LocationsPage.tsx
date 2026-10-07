import { useCallback, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { ChevronRight, FolderOpen, MoreHorizontal, Plus } from 'lucide-react'
import { useUiPreferences } from '@emdad/core'
import { ConfirmDialog, DataTable, EmptyState, PageHeader, ResetFiltersButton } from '@emdad/ui'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@emdad/ui/ui/dialog'
import { Alert, AlertDescription, AlertTitle } from '@emdad/ui/ui/alert'
import { Badge } from '@emdad/ui/ui/badge'
import { Button } from '@emdad/ui/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@emdad/ui/ui/dropdown-menu'
import { Input } from '@emdad/ui/ui/input'
import { Label } from '@emdad/ui/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@emdad/ui/ui/select'
import { toast } from 'sonner'
import { InventoryApi } from '@/api/inventory'
import { type Location, LocationsApi } from '@/api/locations'
import { QK } from '@/constants/query-keys'
import { CHUNK_SIZE_STANDARD, useChunkedServerPagination } from '@/hooks/useChunkedServerPagination'
import { useDefaultWarehouseId } from '@/hooks/useDefaultWarehouse'
import { useFilters } from '@/hooks/useFilters'
import { locationTypeLabel, managedLocationTypeOptions } from '@/lib/location-types'
import { invalidateWorkflowTasksInventory } from '@/lib/invalidate-wms-queries'
import { CreateLocationDialog, EditLocationDialog } from './LocationFormDialogs'

type LocationDraftFilters = { name: string; barcode: string; locationType: string }
type BreadcrumbCrumb = { id: string | null; name: string }

const INCLUDE_ARCHIVED = true

export function LocationsPage() {
  const { isArabic } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const qc = useQueryClient()
  const { warehouseId, warehouses } = useDefaultWarehouseId()

  const initial = useMemo<LocationDraftFilters>(() => ({ name: '', barcode: '', locationType: '' }), [])
  const { draftFilters, appliedFilters, setDraft, applyFilters, resetFilters } = useFilters(initial)

  const [trail, setTrail] = useState<BreadcrumbCrumb[]>([{ id: null, name: 'root' }])
  const [openCreate, setOpenCreate] = useState(false)
  const [editLoc, setEditLoc] = useState<Location | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Location | null>(null)
  const [stockLoc, setStockLoc] = useState<Location | null>(null)

  const currentParentId = trail[trail.length - 1]?.id ?? null

  const listFilterKey = useMemo(() => {
    const search = appliedFilters.barcode.trim() || appliedFilters.name.trim() || undefined
    return {
      warehouseId: warehouseId ?? '',
      parentId: currentParentId,
      search,
      type: appliedFilters.locationType.trim() || undefined,
      includeArchived: INCLUDE_ARCHIVED,
    }
  }, [warehouseId, currentParentId, appliedFilters])

  const fetchChunk = useCallback(
    (offset: number, limit: number) => {
      if (!warehouseId) return Promise.resolve({ items: [], total: 0, limit, offset })
      return LocationsApi.listChildren({
        warehouseId,
        parentId: currentParentId ?? undefined,
        offset,
        limit,
        search: listFilterKey.search,
        type: listFilterKey.type,
        includeArchived: INCLUDE_ARCHIVED,
      })
    },
    [warehouseId, currentParentId, listFilterKey.search, listFilterKey.type],
  )

  const pagination = useChunkedServerPagination<Location>({
    chunkSize: CHUNK_SIZE_STANDARD,
    filterKey: listFilterKey,
    fetchChunk,
    rtQueryKeyPrefix: QK.locations.all,
    chunkQueryKeyPrefix: 'locations-children-chunk',
    enabled: !!warehouseId,
  })

  const purgeCtx = useQuery({
    queryKey: warehouseId ? QK.locationsPurgeContext(warehouseId) : ['locations', 'purge-context', 'none'],
    queryFn: () => LocationsApi.purgeContext(warehouseId!),
    enabled: !!warehouseId,
  })

  const blockDeleteSet = useMemo(() => {
    const s = new Set<string>()
    for (const id of purgeCtx.data?.locationIdsWithStock ?? []) s.add(id)
    for (const id of purgeCtx.data?.locationIdsOnAdjustments ?? []) s.add(id)
    return s
  }, [purgeCtx.data])

  const invalidateLocationQueries = () => {
    if (!warehouseId) return
    qc.invalidateQueries({ queryKey: QK.locations.all })
    qc.invalidateQueries({ queryKey: ['locations', 'lookup'] })
    qc.invalidateQueries({ queryKey: QK.locationsPurgeContext(warehouseId) })
    invalidateWorkflowTasksInventory(qc)
  }

  const createMut = useMutation({
    mutationFn: LocationsApi.create,
    onSuccess: (loc) => {
      toast.success(t(`Location ${loc.barcode} created.`, `تم إنشاء ${loc.barcode}.`))
      invalidateLocationQueries()
      setOpenCreate(false)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof LocationsApi.update>[1] }) =>
      LocationsApi.update(id, patch),
    onSuccess: () => {
      toast.success(t('Location updated.', 'تم تحديث الموقع.'))
      invalidateLocationQueries()
      setEditLoc(null)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const archiveMut = useMutation({
    mutationFn: (id: string) => LocationsApi.archive(id),
    onSuccess: () => {
      toast.success(t('Location archived.', 'تم أرشفة الموقع.'))
      invalidateLocationQueries()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const permanentDeleteMut = useMutation({
    mutationFn: (id: string) => LocationsApi.permanentDelete(id),
    onSuccess: (res) => {
      toast.success(t(`Deleted ${res.deletedIds.length} location(s).`, `تم حذف ${res.deletedIds.length} موقع.`))
      invalidateLocationQueries()
      setPendingDelete(null)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const navigateToCrumb = (index: number) => {
    setTrail((prev) => prev.slice(0, index + 1))
    pagination.resetPage()
  }

  const navigateInto = (row: Location) => {
    if ((row.childCount ?? 0) <= 0) return
    setTrail((prev) => [...prev, { id: row.id, name: row.name }])
    pagination.resetPage()
  }

  const typeFilterOptions = useMemo(
    () => [{ value: '', label: t('All types', 'كل الأنواع') }, ...managedLocationTypeOptions(isArabic)],
    [isArabic], // eslint-disable-line react-hooks/exhaustive-deps
  )

  const columns = useMemo<ColumnDef<Location>[]>(
    () => [
      {
        id: 'name',
        header: t('Location', 'الموقع'),
        cell: ({ row }) => {
          const loc = row.original
          const hasChildren = (loc.childCount ?? 0) > 0
          return (
            <div className="flex min-w-0 items-center gap-2">
              {hasChildren ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1 px-2 font-medium"
                  onClick={(e) => {
                    e.stopPropagation()
                    navigateInto(loc)
                  }}
                >
                  <FolderOpen className="size-4 shrink-0 text-primary" aria-hidden />
                  {loc.name}
                  <ChevronRight className="size-4 shrink-0 opacity-60 rtl:rotate-180" aria-hidden />
                </Button>
              ) : (
                <span className="text-sm font-medium">{loc.name}</span>
              )}
              <span className="truncate text-sm text-muted-foreground">{loc.fullPath}</span>
            </div>
          )
        },
      },
      {
        id: 'barcode',
        header: 'Barcode',
        cell: ({ row }) => <span className="font-mono text-sm">{row.original.barcode}</span>,
      },
      {
        id: 'type',
        header: t('Type', 'النوع'),
        cell: ({ row }) => (
          <span className="text-sm">{locationTypeLabel(row.original.type, isArabic)}</span>
        ),
      },
      {
        id: 'status',
        header: t('Status', 'الحالة'),
        cell: ({ row }) => (
          <Badge variant={row.original.status === 'blocked' ? 'secondary' : 'outline'}>
            {row.original.status === 'blocked' ? t('Suspended', 'موقوف') : t('Active', 'نشط')}
          </Badge>
        ),
      },
      {
        id: 'children',
        header: t('Children', 'فرعي'),
        cell: ({ row }) => (
          <span className="text-sm tabular-nums">{row.original.childCount ?? 0}</span>
        ),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          const loc = row.original
          const blocked = blockDeleteSet.has(loc.id)
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-8" aria-label={t('Actions', 'إجراءات')}>
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setEditLoc(loc)}>{t('Edit', 'تعديل')}</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStockLoc(loc)}>{t('View stock', 'عرض المخزون')}</DropdownMenuItem>
                <DropdownMenuItem onClick={() => archiveMut.mutate(loc.id)}>{t('Archive', 'أرشفة')}</DropdownMenuItem>
                {!blocked ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive" onClick={() => setPendingDelete(loc)}>
                      {t('Delete subtree', 'حذف الشجرة')}
                    </DropdownMenuItem>
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          )
        },
      },
    ],
    [isArabic, blockDeleteSet, archiveMut], // eslint-disable-line react-hooks/exhaustive-deps
  )

  const warehouseLabel = warehouses.find((w) => w.id === warehouseId)?.name

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('Locations', 'المواقع التخزينية')}
        description={
          warehouseLabel
            ? t(`Warehouse: ${warehouseLabel}`, `المستودع: ${warehouseLabel}`)
            : t('Manage warehouse storage locations.', 'إدارة مواقع التخزين.')
        }
        actions={
          <Button disabled={!warehouseId} onClick={() => setOpenCreate(true)}>
            <Plus className="size-4" aria-hidden />
            {t('New location', 'موقع جديد')}
          </Button>
        }
      />

      <nav aria-label={t('Location hierarchy', 'تسلسل المواقع')} className="flex flex-wrap items-center gap-1 text-sm">
        {trail.map((crumb, idx) => {
          const displayName = crumb.id === null ? t('Locations', 'المواقع') : crumb.name
          return (
            <span key={crumb.id ?? 'root'} className="inline-flex items-center gap-1">
              {idx > 0 ? <span className="text-muted-foreground">/</span> : null}
              {idx < trail.length - 1 ? (
                <button
                  type="button"
                  className="font-medium text-primary hover:underline"
                  onClick={() => navigateToCrumb(idx)}
                >
                  {displayName}
                </button>
              ) : (
                <span className="font-semibold">{displayName}</span>
              )}
            </span>
          )
        })}
      </nav>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label>{t('Location name', 'اسم الموقع')}</Label>
          <Input
            value={draftFilters.name}
            onChange={(e) => setDraft({ name: e.target.value })}
            placeholder={t('Contains…', 'يحتوي…')}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Barcode</Label>
          <Input
            value={draftFilters.barcode}
            onChange={(e) => setDraft({ barcode: e.target.value })}
            className="font-mono"
          />
        </div>
        <div className="space-y-1.5">
          <Label>{t('Type', 'النوع')}</Label>
          <Select value={draftFilters.locationType || '__all__'} onValueChange={(v) => setDraft({ locationType: v === '__all__' ? '' : v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {typeFilterOptions.map((o) => (
                <SelectItem key={o.value || '__all__'} value={o.value || '__all__'}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              applyFilters()
              pagination.resetPage()
            }}
          >
            {t('Apply', 'تطبيق')}
          </Button>
          <ResetFiltersButton
            label={t('Reset', 'إعادة تعيين')}
            onClick={() => {
              resetFilters()
              pagination.resetPage()
            }}
          />
        </div>
      </div>

      {!warehouseId ? (
        <Alert>
          <AlertTitle>{t('Warehouse required', 'يلزم مستودع')}</AlertTitle>
          <AlertDescription>
            {t('Select a default warehouse to browse locations.', 'اختر مستودعاً افتراضياً لعرض المواقع.')}
          </AlertDescription>
        </Alert>
      ) : (
        <DataTable<Location>
          columns={columns}
          data={pagination.rows}
          getRowId={(loc) => loc.id}
          loading={pagination.isInitialLoading}
          empty={<EmptyState title={t('No locations at this level.', 'لا مواقع في هذا المستوى.')} />}
          pagination={{
            page: pagination.page,
            pageSize: pagination.pageSize,
            total: pagination.total,
            onPageChange: pagination.setPage,
            onPageSizeChange: () => {},
          }}
        />
      )}

      <CreateLocationDialog
        open={openCreate}
        onClose={() => setOpenCreate(false)}
        loading={createMut.isPending}
        warehouseId={warehouseId}
        defaultParentId={currentParentId}
        onSubmit={(input) => createMut.mutate(input)}
      />

      <EditLocationDialog
        open={!!editLoc}
        location={editLoc}
        loading={updateMut.isPending}
        onClose={() => setEditLoc(null)}
        onSubmit={(patch) => editLoc && updateMut.mutate({ id: editLoc.id, patch })}
      />

      <ConfirmDialog
        open={!!pendingDelete}
        title={t('Delete location subtree?', 'حذف شجرة المواقع؟')}
        description={pendingDelete?.fullPath}
        confirmLabel={t('Delete permanently', 'حذف نهائي')}
        cancelLabel={t('Cancel', 'إلغاء')}
        intent="danger"
        loading={permanentDeleteMut.isPending}
        onOpenChange={(o) => !o && !permanentDeleteMut.isPending && setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) permanentDeleteMut.mutate(pendingDelete.id)
        }}
      />

      <LocationStockDialog
        location={stockLoc}
        warehouseId={warehouseId}
        onClose={() => setStockLoc(null)}
        isArabic={isArabic}
      />
    </div>
  )
}

function LocationStockDialog({
  location,
  warehouseId,
  onClose,
  isArabic,
}: {
  location: Location | null
  warehouseId: string | undefined
  onClose: () => void
  isArabic: boolean
}) {
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const open = !!location

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
  })

  const rows = stock.data?.items ?? []

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {location ? `${t('Stock', 'المخزون')} · ${location.fullPath}` : t('Stock', 'المخزون')}
          </DialogTitle>
        </DialogHeader>
        {stock.isLoading ? (
          <p className="text-sm text-muted-foreground">{t('Loading…', 'جاري التحميل…')}</p>
        ) : rows.length === 0 ? (
          <p className="text-sm">{t('No stock at this location.', 'لا مخزون في هذا الموقع.')}</p>
        ) : (
          <ul className="max-h-64 space-y-1 overflow-y-auto text-sm">
            {rows.map((r) => (
              <li key={r.id} className="flex justify-between gap-2 border-b border-border py-1">
                <span>{r.product?.name ?? r.productId}</span>
                <span className="font-mono tabular-nums">{Number(r.quantityOnHand).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
        <DialogFooter>
          <Button type="button" onClick={onClose}>
            {t('Close', 'إغلاق')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
