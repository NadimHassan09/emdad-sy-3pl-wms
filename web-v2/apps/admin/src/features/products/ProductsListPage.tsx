import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { MoreHorizontal, Plus } from 'lucide-react'
import { useUiPreferences } from '@emdad/core'
import { ConfirmDialog, DataTable, EmptyState, PageHeader, SearchInput, useNavigate } from '@emdad/ui'
import { Alert, AlertDescription, AlertTitle } from '@emdad/ui/ui/alert'
import { Button } from '@emdad/ui/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@emdad/ui/ui/dropdown-menu'
import { toast } from 'sonner'
import { type Product, type UpdateProductInput, ProductsApi } from '@/api/products'
import { QK } from '@/constants/query-keys'
import { CHUNK_SIZE_STANDARD, useChunkedServerPagination } from '@/hooks/useChunkedServerPagination'
import { useFilters } from '@/hooks/useFilters'
import { useDebounced } from '@/lib/useDebounced'
import { productUomLabel } from '@/lib/product-labels'
import { CreateProductDialog, EditProductDialog } from './ProductFormDialogs'
import { ProductStatusBadge } from './products-ui'

type ProductDraftFilters = { search: string }

export function ProductsListPage() {
  const { isArabic } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const navigate = useNavigate()
  const qc = useQueryClient()

  const initial = useMemo<ProductDraftFilters>(() => ({ search: '' }), [])
  const { draftFilters, appliedFilters, setDraft, applyPatch } = useFilters(initial)

  const [openCreate, setOpenCreate] = useState(false)
  const [editProduct, setEditProduct] = useState<Product | null>(null)
  const [confirmAction, setConfirmAction] = useState<
    | { type: 'suspend'; product: Product }
    | { type: 'hardDelete'; product: Product }
    | { type: 'archive'; product: Product }
    | null
  >(null)

  const debouncedSearch = useDebounced(draftFilters.search, 300)
  useEffect(() => {
    if (debouncedSearch === appliedFilters.search) return
    applyPatch({ search: debouncedSearch })
  }, [debouncedSearch, appliedFilters.search, applyPatch])

  const filters = useMemo(
    () => ({ search: appliedFilters.search.trim() || undefined }),
    [appliedFilters],
  )

  const pagination = useChunkedServerPagination<Product>({
    chunkSize: CHUNK_SIZE_STANDARD,
    filterKey: filters,
    fetchChunk: (offset, limit) => ProductsApi.list({ ...filters, offset, limit }),
    rtQueryKeyPrefix: QK.products,
    chunkQueryKeyPrefix: 'products-chunk',
  })

  const invalidateProducts = () => qc.invalidateQueries({ queryKey: QK.products })

  const createMut = useMutation({
    mutationFn: ProductsApi.create,
    onSuccess: () => {
      toast.success(t('Product created.', 'تم إنشاء المنتج.'))
      invalidateProducts()
      setOpenCreate(false)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateProductInput }) => ProductsApi.update(id, input),
    onSuccess: () => {
      toast.success(t('Product saved.', 'تم حفظ المنتج.'))
      invalidateProducts()
      setEditProduct(null)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const suspendMut = useMutation({
    mutationFn: (id: string) => ProductsApi.suspend(id),
    onSuccess: () => {
      toast.success(t('Product suspended.', 'تم إيقاف المنتج.'))
      invalidateProducts()
      setConfirmAction(null)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const unsuspendMut = useMutation({
    mutationFn: (id: string) => ProductsApi.unsuspend(id),
    onSuccess: () => {
      toast.success(t('Product reactivated.', 'تم إعادة تفعيل المنتج.'))
      invalidateProducts()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const hardDeleteMut = useMutation({
    mutationFn: (id: string) => ProductsApi.hardDelete(id),
    onSuccess: (_, id) => {
      toast.success(t('Product deleted.', 'تم حذف المنتج.'))
      invalidateProducts()
      setEditProduct((prev) => (prev?.id === id ? null : prev))
      setConfirmAction(null)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const archiveMut = useMutation({
    mutationFn: (id: string) => ProductsApi.archive(id),
    onSuccess: (updated) => {
      toast.success(t('Product archived.', 'تم أرشفة المنتج.'))
      invalidateProducts()
      setEditProduct((prev) => (prev?.id === updated.id ? null : prev))
      setConfirmAction(null)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const columns = useMemo<ColumnDef<Product>[]>(
    () => [
      {
        id: 'name',
        header: t('Product', 'المنتج'),
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{row.original.name}</p>
            {row.original.company?.name ? (
              <p className="truncate text-sm text-muted-foreground">{row.original.company.name}</p>
            ) : null}
          </div>
        ),
      },
      {
        id: 'sku',
        header: 'SKU',
        cell: ({ row }) => <span className="font-mono text-sm">{row.original.sku}</span>,
      },
      {
        id: 'uom',
        header: 'UOM',
        cell: ({ row }) => <span className="text-sm">{productUomLabel(row.original.uom, isArabic)}</span>,
      },
      {
        id: 'status',
        header: t('Status', 'الحالة'),
        cell: ({ row }) => <ProductStatusBadge status={row.original.status} isArabic={isArabic} />,
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          const p = row.original
          if (p.status === 'archived') return null
          const canEdit = p.status === 'active' || p.status === 'suspended'
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-8" aria-label={t('Actions', 'إجراءات')}>
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {canEdit ? (
                  <DropdownMenuItem onClick={() => setEditProduct(p)}>{t('Edit', 'تعديل')}</DropdownMenuItem>
                ) : null}
                {p.status === 'active' ? (
                  <DropdownMenuItem onClick={() => setConfirmAction({ type: 'suspend', product: p })}>
                    {t('Suspend', 'إيقاف')}
                  </DropdownMenuItem>
                ) : null}
                {p.status === 'suspended' ? (
                  <DropdownMenuItem onClick={() => unsuspendMut.mutate(p.id)}>{t('Unsuspend', 'إلغاء الإيقاف')}</DropdownMenuItem>
                ) : null}
                {p.deletable ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => setConfirmAction({ type: 'hardDelete', product: p })}
                    >
                      {t('Delete', 'حذف')}
                    </DropdownMenuItem>
                  </>
                ) : null}
                {p.archivable && !p.deletable ? (
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => setConfirmAction({ type: 'archive', product: p })}
                  >
                    {t('Archive', 'أرشفة')}
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          )
        },
      },
    ],
    [isArabic, unsuspendMut], // eslint-disable-line react-hooks/exhaustive-deps
  )

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('Products', 'المنتجات')}
        description={t('Warehouse product catalog', 'كتالوج منتجات المستودع')}
        actions={
          <Button onClick={() => setOpenCreate(true)}>
            <Plus className="size-4" aria-hidden />
            {t('New product', 'منتج جديد')}
          </Button>
        }
      />

      {pagination.isError ? (
        <Alert variant="destructive">
          <AlertTitle>{t('Could not load products.', 'تعذّر تحميل المنتجات.')}</AlertTitle>
          <AlertDescription>
            <Button variant="link" className="h-auto p-0" onClick={() => pagination.refetch()}>
              {t('Retry', 'إعادة المحاولة')}
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <SearchInput
        value={draftFilters.search}
        onChange={(v) => setDraft({ search: v })}
        placeholder={t('Search product, SKU, barcode…', 'بحث منتج، SKU، باركود…')}
        className="max-w-md"
      />

      <DataTable<Product>
        columns={columns}
        data={pagination.rows}
        getRowId={(p) => p.id}
        loading={pagination.isInitialLoading}
        empty={<EmptyState title={t('No products match the filters.', 'لا توجد منتجات مطابقة للفلاتر.')} />}
        onRowClick={(p) => navigate(`/products/${encodeURIComponent(p.sku)}`)}
        pagination={{
          page: pagination.page,
          pageSize: pagination.pageSize,
          total: pagination.total,
          onPageChange: pagination.setPage,
          onPageSizeChange: () => {},
        }}
      />

      <CreateProductDialog
        open={openCreate}
        onClose={() => setOpenCreate(false)}
        loading={createMut.isPending}
        onSubmit={(input) => createMut.mutate(input)}
      />

      <EditProductDialog
        open={!!editProduct}
        product={editProduct}
        loading={updateMut.isPending}
        onClose={() => setEditProduct(null)}
        onSubmit={(input) => editProduct && updateMut.mutate({ id: editProduct.id, input })}
      />

      <ConfirmDialog
        open={confirmAction?.type === 'suspend'}
        title={t('Suspend product?', 'إيقاف المنتج؟')}
        description={confirmAction?.product.sku}
        confirmLabel={t('Suspend', 'إيقاف')}
        cancelLabel={t('Cancel', 'إلغاء')}
        onConfirm={() => {
          if (confirmAction?.type === 'suspend') suspendMut.mutate(confirmAction.product.id)
        }}
        onOpenChange={(v) => !v && setConfirmAction(null)}
        loading={suspendMut.isPending}
      />

      <ConfirmDialog
        open={confirmAction?.type === 'hardDelete'}
        title={t('Delete product permanently?', 'حذف المنتج نهائياً؟')}
        description={t(
          'Only products with zero stock and no history can be deleted.',
          'متاح فقط للمنتجات بلا مخزون ولا سجل.',
        )}
        confirmLabel={t('Delete', 'حذف')}
        cancelLabel={t('Cancel', 'إلغاء')}
        intent="danger"
        onConfirm={() => {
          if (confirmAction?.type === 'hardDelete') hardDeleteMut.mutate(confirmAction.product.id)
        }}
        onOpenChange={(v) => !v && setConfirmAction(null)}
        loading={hardDeleteMut.isPending}
      />

      <ConfirmDialog
        open={confirmAction?.type === 'archive'}
        title={t('Archive product?', 'أرشفة المنتج؟')}
        description={confirmAction?.product.sku}
        confirmLabel={t('Archive', 'أرشفة')}
        cancelLabel={t('Cancel', 'إلغاء')}
        intent="danger"
        onConfirm={() => {
          if (confirmAction?.type === 'archive') archiveMut.mutate(confirmAction.product.id)
        }}
        onOpenChange={(v) => !v && setConfirmAction(null)}
        loading={archiveMut.isPending}
      />
    </div>
  )
}
