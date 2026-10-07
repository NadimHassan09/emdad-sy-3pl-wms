import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { Box, MoreHorizontal, Plus } from 'lucide-react'
import { useUiPreferences } from '@emdad/core'
import {
  ConfirmDialog,
  DataTable,
  EmptyState,
  ErrorState,
  PageHeader,
  SearchInput,
  useNavigate,
} from '@emdad/ui'
import { Button } from '@emdad/ui/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@emdad/ui/ui/dropdown-menu'
import { toast } from 'sonner'
import { useAuth } from '@/auth/AuthContext'
import { CHUNK_SIZE_STANDARD, useChunkedServerPagination } from '@/hooks/useChunkedServerPagination'
import { useClientOperationalAccess } from '@/hooks/useClientOperationalAccess'
import { useFilters } from '@/hooks/useFilters'
import { clientMediaSrc } from '@/lib/client-media'
import { isClientAdmin } from '@/lib/rbac'
import {
  deleteClientProduct,
  fetchClientProducts,
  type ClientProductRow,
} from '@/services/clientProductsService'
import {
  StockHealthBadge,
  fmtQty,
  productAvailableQty,
  stockHealth,
  useDebounced,
} from './products-ui'

type ProductDraftFilters = { search: string }

export function ProductsListPage() {
  const { isArabic } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const canManage = isClientAdmin(user?.role)
  const billingAccess = useClientOperationalAccess(isArabic)

  const initial = useMemo<ProductDraftFilters>(() => ({ search: '' }), [])
  const { draftFilters, appliedFilters, setDraft, applyPatch } = useFilters(initial)

  const [deleteTarget, setDeleteTarget] = useState<ClientProductRow | null>(null)

  const debouncedSearch = useDebounced(draftFilters.search, 300)
  useEffect(() => {
    if (debouncedSearch === appliedFilters.search) return
    applyPatch({ search: debouncedSearch })
  }, [debouncedSearch, appliedFilters.search, applyPatch])

  const filters = useMemo(
    () => ({ search: appliedFilters.search.trim() || undefined }),
    [appliedFilters],
  )

  const pagination = useChunkedServerPagination<ClientProductRow>({
    chunkSize: CHUNK_SIZE_STANDARD,
    filterKey: filters,
    fetchChunk: (offset, limit) => fetchClientProducts({ ...filters, offset, limit }),
    rtQueryKeyPrefix: ['client', 'products'],
    chunkQueryKeyPrefix: 'client-products-chunk',
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteClientProduct(id),
    onSuccess: () => {
      toast.success(t('Product deleted.', 'تم حذف المنتج.'))
      void queryClient.invalidateQueries({ queryKey: ['client', 'products'] })
      setDeleteTarget(null)
    },
    onError: (err: Error) => {
      toast.error(err.message || t('Could not delete product.', 'تعذر حذف المنتج.'))
      setDeleteTarget(null)
    },
  })

  const columns = useMemo<ColumnDef<ClientProductRow>[]>(
    () => [
      {
        id: 'product',
        header: t('Product', 'المنتج'),
        cell: ({ row }) => {
          const p = row.original
          const src = clientMediaSrc(p.imageUrl)
          return (
            <div className="flex min-w-0 items-center gap-3">
              {src ? (
                <img
                  src={src}
                  alt=""
                  className="size-9 shrink-0 rounded-lg border object-cover"
                />
              ) : (
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <Box className="size-3.5" aria-hidden />
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{p.name}</p>
                <p className="truncate text-xs text-muted-foreground">{p.description || '—'}</p>
              </div>
            </div>
          )
        },
        meta: { priority: 1, className: 'min-w-48' },
      },
      {
        id: 'sku',
        header: t('SKU', 'رمز SKU'),
        cell: ({ row }) => <span className="font-mono text-sm">{row.original.sku}</span>,
        meta: { priority: 1, className: 'min-w-28' },
      },
      {
        id: 'available',
        header: t('Available', 'المتاح'),
        cell: ({ row }) => {
          const available = productAvailableQty(row.original)
          return (
            <span className="font-semibold tabular-nums">
              {fmtQty(row.original.totalAvailable ?? String(available))}
            </span>
          )
        },
        meta: { priority: 1, align: 'end', className: 'min-w-24' },
      },
      {
        id: 'reserved',
        header: t('Reserved', 'المحجوز'),
        cell: ({ row }) => (
          <span className="tabular-nums text-muted-foreground">
            {fmtQty(row.original.totalReserved)}
          </span>
        ),
        meta: { priority: 2, align: 'end', className: 'min-w-24' },
      },
      {
        id: 'onHand',
        header: t('On hand', 'المتواجد'),
        cell: ({ row }) => (
          <span className="tabular-nums">{fmtQty(row.original.totalOnHand)}</span>
        ),
        meta: { priority: 2, align: 'end', className: 'min-w-24' },
      },
      {
        id: 'health',
        header: t('Status', 'الحالة'),
        cell: ({ row }) => {
          const available = productAvailableQty(row.original)
          const health = stockHealth(available, Number(row.original.minStockThreshold) || 0)
          return <StockHealthBadge health={health} isArabic={isArabic} />
        },
        meta: { priority: 1, className: 'min-w-28' },
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          const p = row.original
          const canDelete =
            canManage && billingAccess.operationalAllowed && Boolean(p.deletable)
          if (!canManage) return null
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  aria-label={t('Actions', 'إجراءات')}
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation()
                    navigate(`/products/${p.id}/edit`)
                  }}
                >
                  {t('Edit', 'تعديل')}
                </DropdownMenuItem>
                {canDelete ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={(e) => {
                        e.stopPropagation()
                        setDeleteTarget(p)
                      }}
                    >
                      {t('Delete', 'حذف')}
                    </DropdownMenuItem>
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          )
        },
        meta: { align: 'end', cardAction: true, hideInCard: true },
      },
    ],
    [isArabic, canManage, billingAccess.operationalAllowed, navigate], // eslint-disable-line react-hooks/exhaustive-deps
  )

  const hasSearch = Boolean(filters.search)

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('Inventory', 'المخزون')}
        description={t('Sellable stock and catalog', 'المخزون القابل للبيع والكتالوج')}
        actions={
          canManage ? (
            <Button
              disabled={!billingAccess.operationalAllowed}
              title={
                !billingAccess.operationalAllowed
                  ? billingAccess.actionBlockedReason
                  : undefined
              }
              onClick={() => navigate('/products/new')}
            >
              <Plus className="size-4" aria-hidden />
              {t('New product', 'منتج جديد')}
            </Button>
          ) : null
        }
      />

      {pagination.isError ? (
        <ErrorState
          title={t('Could not load products', 'تعذر تحميل المنتجات')}
          description={(pagination.error as Error)?.message}
          retryLabel={t('Retry', 'إعادة المحاولة')}
          onRetry={() => pagination.refetch()}
        />
      ) : null}

      <SearchInput
        value={draftFilters.search}
        onChange={(v) => setDraft({ search: v })}
        placeholder={t('Search name or SKU…', 'ابحث بالاسم أو رمز SKU…')}
        className="max-w-md"
      />

      <DataTable<ClientProductRow>
        columns={columns}
        data={pagination.rows}
        getRowId={(p) => p.id}
        loading={pagination.isInitialLoading}
        empty={
          <EmptyState
            title={
              hasSearch
                ? t('No products match your search.', 'لا توجد منتجات مطابقة لبحثك.')
                : t('No products found.', 'لا توجد منتجات.')
            }
            description={
              hasSearch
                ? undefined
                : t(
                    'Add your first catalog product to track sellable stock.',
                    'أضف أول منتج في الكتالوج لتتبع المخزون القابل للبيع.',
                  )
            }
            action={
              canManage && billingAccess.operationalAllowed && !hasSearch ? (
                <Button onClick={() => navigate('/products/new')}>
                  <Plus className="size-4" aria-hidden />
                  {t('Create first product', 'إنشاء أول منتج')}
                </Button>
              ) : undefined
            }
          />
        }
        onRowClick={(p) => navigate(`/products/${p.id}`)}
        pagination={{
          page: pagination.page,
          pageSize: pagination.pageSize,
          total: pagination.total,
          onPageChange: pagination.setPage,
          onPageSizeChange: () => {},
        }}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title={t('Delete product permanently?', 'حذف المنتج نهائياً؟')}
        description={t(
          'Permanently delete this product? This cannot be undone.',
          'حذف هذا المنتج نهائياً؟ لا يمكن التراجع.',
        )}
        confirmLabel={t('Delete', 'حذف')}
        cancelLabel={t('Cancel', 'إلغاء')}
        intent="danger"
        loading={deleteMut.isPending}
        onConfirm={() => {
          if (deleteTarget) deleteMut.mutate(deleteTarget.id)
        }}
        onOpenChange={(v) => {
          if (!v) setDeleteTarget(null)
        }}
      />
    </div>
  )
}
