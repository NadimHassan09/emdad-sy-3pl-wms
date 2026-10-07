import { type FormEvent, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { MoreHorizontal, Plus } from 'lucide-react'
import { useUiPreferences } from '@emdad/core'
import { DataTable, PageHeader, SearchInput, useNavigate } from '@emdad/ui'
import { Alert, AlertDescription, AlertTitle } from '@emdad/ui/ui/alert'
import { Button } from '@emdad/ui/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@emdad/ui/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@emdad/ui/ui/dropdown-menu'
import { Input } from '@emdad/ui/ui/input'
import { Label } from '@emdad/ui/ui/label'
import { toast } from 'sonner'
import {
  BillingApi,
  type BillingPlanTemplateRow,
  type CreateBillingPlanTemplatePayload,
  type UpdateBillingPlanTemplatePayload,
} from '@/api/billing'
import { useAuth } from '@/auth/AuthContext'
import { QK } from '@/constants/query-keys'
import { formatDecimal } from '@/lib/billing-plan-overview'
import { BILLING_CURRENCY, canMutateBilling } from './billing-ui'

type TemplateForm = {
  name: string
  reservedVolume: string
  fixedSubscriptionFee: string
  cycleLengthDays: string
}

const EMPTY_FORM: TemplateForm = {
  name: '',
  reservedVolume: '0',
  fixedSubscriptionFee: '0',
  cycleLengthDays: '30',
}

function toPayload(form: TemplateForm): CreateBillingPlanTemplatePayload {
  return {
    name: form.name.trim(),
    reservedVolume: Number(form.reservedVolume) || 0,
    fixedSubscriptionFee: Number(form.fixedSubscriptionFee) || 0,
    cycleLengthDays: Math.max(1, Math.floor(Number(form.cycleLengthDays)) || 30),
  }
}

export function BillingPlanTemplatesPage() {
  const { isArabic } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { user } = useAuth()
  const canMutate = canMutateBilling(user?.role)

  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<BillingPlanTemplateRow | null>(null)
  const [form, setForm] = useState<TemplateForm>(EMPTY_FORM)

  const templatesQuery = useQuery({
    queryKey: [...QK.billing.templates, search],
    queryFn: () => BillingApi.listTemplates(),
  })

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (templatesQuery.data ?? []).filter((r) => !q || r.name.toLowerCase().includes(q))
  }, [templatesQuery.data, search])

  const invalidate = () => void qc.invalidateQueries({ queryKey: QK.billing.templates })

  const createMut = useMutation({
    mutationFn: (payload: CreateBillingPlanTemplatePayload) => BillingApi.createTemplate(payload),
    onSuccess: () => {
      toast.success(t('Template created.', 'تم إنشاء القالب.'))
      setModalOpen(false)
      setForm(EMPTY_FORM)
      invalidate()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateBillingPlanTemplatePayload }) =>
      BillingApi.updateTemplate(id, payload),
    onSuccess: () => {
      toast.success(t('Template updated.', 'تم تحديث القالب.'))
      setModalOpen(false)
      setEditing(null)
      setForm(EMPTY_FORM)
      invalidate()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => BillingApi.deleteTemplate(id),
    onSuccess: () => {
      toast.success(t('Template deleted.', 'تم حذف القالب.'))
      invalidate()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setModalOpen(true)
  }

  const openEdit = (row: BillingPlanTemplateRow) => {
    setEditing(row)
    setForm({
      name: row.name,
      reservedVolume: row.reservedVolume,
      fixedSubscriptionFee: row.fixedSubscriptionFee,
      cycleLengthDays: String(row.cycleLengthDays),
    })
    setModalOpen(true)
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) {
      toast.error(t('Name is required.', 'الاسم مطلوب.'))
      return
    }
    const payload = toPayload(form)
    if (editing) updateMut.mutate({ id: editing.id, payload })
    else createMut.mutate(payload)
  }

  const columns = useMemo<ColumnDef<BillingPlanTemplateRow>[]>(
    () => [
      { header: t('Name', 'الاسم'), accessorKey: 'name', meta: { priority: 1 } },
      {
        header: t('Reserved volume', 'الحجم المحجوز'),
        cell: ({ row }) => `${formatDecimal(row.original.reservedVolume, 2)} m³`,
        meta: { priority: 2 },
      },
      {
        header: t('Price', 'السعر'),
        cell: ({ row }) => `${formatDecimal(row.original.fixedSubscriptionFee)} ${BILLING_CURRENCY}`,
        meta: { priority: 2 },
      },
      {
        header: t('Cycle (days)', 'الدورة (أيام)'),
        accessorKey: 'cycleLengthDays',
        meta: { priority: 3 },
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) =>
          canMutate ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-8">
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => openEdit(row.original)}>{t('Edit', 'تعديل')}</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => deleteMut.mutate(row.original.id)}
                >
                  {t('Delete', 'حذف')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null,
        meta: { cardAction: true, align: 'end' },
      },
    ],
    [canMutate, deleteMut, t],
  )

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('Plan templates', 'قوالب الخطط')}
        description={t(
          'Reusable subscription templates for new billing plans.',
          'قوالب اشتراك قابلة لإعادة الاستخدام لخطط جديدة.',
        )}
        actions={
          <>
            <Button variant="outline" onClick={() => navigate('/billing/plans')}>
              {t('Back to plans', 'العودة للخطط')}
            </Button>
            {canMutate ? (
              <Button onClick={openCreate}>
                <Plus className="size-4" />
                {t('New template', 'قالب جديد')}
              </Button>
            ) : null}
          </>
        }
      />

      <Alert>
        <AlertTitle>{t('API note', 'ملاحظة')}</AlertTitle>
        <AlertDescription>
          {t(
            'Template CRUD may be unavailable on this staging API; the list falls back to empty until the backend enables templates.',
            'قد لا تكون واجهة القوالب متاحة على هذا الـ API؛ ستظهر القائمة فارغة حتى يفعّل الخادم القوالب.',
          )}
        </AlertDescription>
      </Alert>

      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder={t('Search templates…', 'بحث في القوالب…')}
        className="max-w-sm"
      />

      <DataTable
        columns={columns}
        data={rows}
        getRowId={(r) => r.id}
        loading={templatesQuery.isPending}
        empty={t('No templates yet.', 'لا قوالب بعد.')}
      />

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>
                {editing ? t('Edit template', 'تعديل القالب') : t('New template', 'قالب جديد')}
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>{t('Name', 'الاسم')}</Label>
                <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
              </div>
              <div className="space-y-2">
                <Label>{t('Reserved volume (m³)', 'الحجم المحجوز')}</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.reservedVolume}
                  onChange={(e) => setForm((f) => ({ ...f, reservedVolume: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>{t(`Price (${BILLING_CURRENCY})`, `السعر (${BILLING_CURRENCY})`)}</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.fixedSubscriptionFee}
                  onChange={(e) => setForm((f) => ({ ...f, fixedSubscriptionFee: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('Cycle length (days)', 'مدة الدورة (أيام)')}</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.cycleLengthDays}
                  onChange={(e) => setForm((f) => ({ ...f, cycleLengthDays: e.target.value }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                {t('Cancel', 'إلغاء')}
              </Button>
              <Button type="submit" disabled={createMut.isPending || updateMut.isPending}>
                {t('Save', 'حفظ')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
