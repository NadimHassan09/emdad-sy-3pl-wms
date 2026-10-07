import { type FormEvent, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Download } from 'lucide-react'
import { useUiPreferences } from '@emdad/core'
import { PageHeader } from '@emdad/ui'
import { Alert, AlertDescription, AlertTitle } from '@emdad/ui/ui/alert'
import { Button } from '@emdad/ui/ui/button'
import { Card, CardContent } from '@emdad/ui/ui/card'
import { Input } from '@emdad/ui/ui/input'
import { Label } from '@emdad/ui/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@emdad/ui/ui/select'
import { Skeleton } from '@emdad/ui/ui/skeleton'
import { toast } from 'sonner'
import { BillingApi, type BillingInvoiceLineRow, type CreateManualInvoiceLinePayload } from '@/api/billing'
import { CompaniesApi } from '@/api/companies'
import { useAuth } from '@/auth/AuthContext'
import { QK } from '@/constants/query-keys'
import {
  formatCycleLabel,
  formatDate,
  formatDecimal,
  lineLabel,
  manualLines,
  orderChargeLines,
  parseRateSnapshot,
  systemLines,
} from '@/lib/billing-invoice-display'
import {
  BILLING_CURRENCY,
  DetailField,
  InvoiceStatusBadge,
  canMutateBilling,
} from './billing-ui'

function LineTable({
  title,
  lines,
  showActions,
  onRemove,
  removingId,
  isArabic,
}: {
  title: string
  lines: BillingInvoiceLineRow[]
  showActions?: boolean
  onRemove?: (id: string) => void
  removingId?: string
  isArabic: boolean
}) {
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  if (!lines.length) return null
  return (
    <div className="mt-4">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h4>
      <div className="mt-2 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b text-start text-xs uppercase text-muted-foreground">
              <th className="py-2 pe-4">{t('Description', 'الوصف')}</th>
              <th className="py-2 pe-4">{t('Qty', 'الكمية')}</th>
              <th className="py-2 pe-4">{t('Unit', 'الوحدة')}</th>
              <th className="py-2 pe-4">{t('Total', 'الإجمالي')}</th>
              {showActions ? <th className="py-2" /> : null}
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.id} className="border-b border-border/60">
                <td className="py-2 pe-4">{lineLabel(line)}</td>
                <td className="py-2 pe-4 font-mono tabular-nums">{formatDecimal(line.quantity, 2)}</td>
                <td className="py-2 pe-4 font-mono tabular-nums">{formatDecimal(line.unitPrice, 2)}</td>
                <td className="py-2 pe-4 font-mono tabular-nums">{formatDecimal(line.totalPrice)}</td>
                {showActions && onRemove ? (
                  <td className="py-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      disabled={removingId === line.id}
                      onClick={() => onRemove(line.id)}
                    >
                      {t('Remove', 'إزالة')}
                    </Button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function BillingInvoiceDetailPage() {
  const { id = '' } = useParams<{ id: string }>()
  const { isArabic } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const { user } = useAuth()
  const qc = useQueryClient()
  const canMutate = canMutateBilling(user?.role)

  const invoiceQuery = useQuery({
    queryKey: [...QK.billing.invoices, id],
    queryFn: () => BillingApi.getInvoice(id),
    enabled: !!id,
  })

  const invoice = invoiceQuery.data
  const companyQuery = useQuery({
    queryKey: [...QK.companies, invoice?.companyId],
    queryFn: () => CompaniesApi.get(invoice!.companyId),
    enabled: !!invoice?.companyId,
  })

  const snapshot = parseRateSnapshot(invoice?.billingCycle?.rateSnapshot)
  const lines = invoice?.lines ?? []
  const cycle = invoice?.billingCycle
  const isDraft = invoice?.status === 'draft'
  const isEditable =
    invoice?.status === 'draft' ||
    invoice?.status === 'unpaid' ||
    invoice?.status === 'open' ||
    invoice?.status === 'overdue'
  const isUnpaid =
    invoice?.status === 'unpaid' || invoice?.status === 'open' || invoice?.status === 'overdue'

  const [manualDesc, setManualDesc] = useState('')
  const [manualQty, setManualQty] = useState('1')
  const [manualUnit, setManualUnit] = useState('0')
  const [discountType, setDiscountType] = useState<'fixed' | 'percentage' | ''>('')
  const [discountValue, setDiscountValue] = useState('')
  const [vatPercentage, setVatPercentage] = useState('')

  useEffect(() => {
    if (!invoice) return
    setDiscountType(invoice.discountType ?? '')
    setDiscountValue(invoice.discountValue ?? '')
    setVatPercentage(invoice.vatPercentage ?? '')
  }, [invoice])

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: [...QK.billing.invoices, id] })
    void qc.invalidateQueries({ queryKey: QK.billing.invoices })
  }

  const statusMut = useMutation({
    mutationFn: (status: 'paid' | 'cancelled' | 'unpaid') => BillingApi.updateInvoiceStatus(id, status),
    onSuccess: () => {
      invalidate()
      toast.success(t('Invoice status updated.', 'تم تحديث الحالة.'))
    },
    onError: () => toast.error(t('Could not update status.', 'تعذر تحديث الحالة.')),
  })

  const issueMut = useMutation({
    mutationFn: () => BillingApi.issueInvoice(id),
    onSuccess: () => {
      invalidate()
      toast.success(t('Invoice issued.', 'تم إصدار الفاتورة.'))
    },
    onError: () => toast.error(t('Could not issue invoice.', 'تعذر إصدار الفاتورة.')),
  })

  const addLineMut = useMutation({
    mutationFn: (payload: CreateManualInvoiceLinePayload) => BillingApi.addManualLine(id, payload),
    onSuccess: () => {
      invalidate()
      setManualDesc('')
      setManualQty('1')
      setManualUnit('0')
      toast.success(t('Charge added.', 'تمت إضافة الرسوم.'))
    },
    onError: () => toast.error(t('Could not add charge.', 'تعذر إضافة الرسوم.')),
  })

  const removeLineMut = useMutation({
    mutationFn: (lineId: string) => BillingApi.removeManualLine(id, lineId),
    onSuccess: () => {
      invalidate()
      toast.success(t('Charge removed.', 'تمت إزالة الرسوم.'))
    },
    onError: () => toast.error(t('Could not remove charge.', 'تعذر إزالة الرسوم.')),
  })

  const updateInvoiceMut = useMutation({
    mutationFn: () =>
      BillingApi.updateInvoice(id, {
        discountType: discountType || null,
        discountValue: discountValue ? Number(discountValue) : null,
        vatPercentage: vatPercentage ? Number(vatPercentage) : undefined,
      }),
    onSuccess: () => {
      invalidate()
      toast.success(t('Invoice updated.', 'تم تحديث الفاتورة.'))
    },
    onError: () => toast.error(t('Could not update invoice.', 'تعذر تحديث الفاتورة.')),
  })

  const handleDownloadPdf = async () => {
    if (!invoice) return
    try {
      const blob = await BillingApi.downloadInvoicePdf(invoice.id)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${invoice.invoiceNumber || 'invoice'}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error(t('Could not download PDF.', 'تعذر تنزيل PDF.'))
    }
  }

  const handleAddManualLine = (e: FormEvent) => {
    e.preventDefault()
    if (!manualDesc.trim()) {
      toast.error(t('Description is required.', 'الوصف مطلوب.'))
      return
    }
    addLineMut.mutate({
      description: manualDesc.trim(),
      quantity: Number(manualQty) || 0,
      unitPrice: Number(manualUnit) || 0,
    })
  }

  const subscriptionLines = systemLines(lines).filter((l) => l.type === 'subscription')
  const otherSystemLines = systemLines(lines).filter((l) => l.type !== 'subscription')
  const clientName = companyQuery.data?.name ?? invoice?.companyId ?? '—'

  return (
    <div className="space-y-5">
      <Link
        to="/billing/invoices"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
        {t('Back to invoices', 'العودة للفواتير')}
      </Link>

      <PageHeader
        title={invoice ? `${t('Invoice', 'فاتورة')} ${invoice.invoiceNumber}` : t('Invoice details', 'تفاصيل الفاتورة')}
        description={clientName}
        actions={
          invoice ? (
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => void handleDownloadPdf()}>
                <Download className="size-4" />
                PDF
              </Button>
              {canMutate && isDraft ? (
                <Button size="sm" disabled={issueMut.isPending} onClick={() => issueMut.mutate()}>
                  {t('Issue invoice', 'إصدار الفاتورة')}
                </Button>
              ) : null}
              {canMutate && isUnpaid ? (
                <Button size="sm" disabled={statusMut.isPending} onClick={() => statusMut.mutate('paid')}>
                  {t('Mark as paid', 'تعيين كمدفوعة')}
                </Button>
              ) : null}
              {canMutate && invoice.status !== 'cancelled' && invoice.status !== 'paid' ? (
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={statusMut.isPending}
                  onClick={() => statusMut.mutate('cancelled')}
                >
                  {t('Cancel invoice', 'إلغاء الفاتورة')}
                </Button>
              ) : null}
            </div>
          ) : undefined
        }
      />

      {invoiceQuery.isPending ? (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <Skeleton className="h-7 w-2/5" />
            <Skeleton className="h-40 w-full" />
          </CardContent>
        </Card>
      ) : null}

      {invoiceQuery.isError ? (
        <Alert variant="destructive">
          <AlertTitle>{t('Could not load invoice', 'تعذر تحميل الفاتورة')}</AlertTitle>
          <AlertDescription>{(invoiceQuery.error as Error).message}</AlertDescription>
        </Alert>
      ) : null}

      {invoice ? (
        <>
          <section className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold">{t('Invoice info', 'معلومات الفاتورة')}</h3>
              <InvoiceStatusBadge status={invoice.status} isArabic={isArabic} />
            </div>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <DetailField label={t('Client', 'العميل')} value={clientName} />
              <DetailField label={t('Billing period', 'فترة الفوترة')} value={formatCycleLabel(cycle)} />
              <DetailField
                label={t('Issue date', 'تاريخ الإصدار')}
                value={invoice.issuedAt ? formatDate(invoice.issuedAt) : '—'}
              />
              <DetailField
                label={t('Due date', 'تاريخ الاستحقاق')}
                value={invoice.dueDate ? formatDate(invoice.dueDate) : '—'}
              />
              {snapshot ? (
                <>
                  <DetailField
                    label={t('Reserved volume', 'الحجم المحجوز')}
                    value={`${formatDecimal(snapshot.reservedVolume, 2)} m³`}
                  />
                  <DetailField
                    label={t('Fixed plan price', 'سعر الخطة')}
                    value={`${formatDecimal(snapshot.fixedSubscriptionFee)} ${BILLING_CURRENCY}`}
                  />
                </>
              ) : null}
            </dl>
          </section>

          <section className="rounded-xl border bg-card p-4 shadow-sm">
            <h3 className="text-sm font-semibold">{t('Charges', 'الرسوم')}</h3>
            <LineTable title={t('Subscription (locked)', 'الاشتراك (مقفل)')} lines={subscriptionLines} isArabic={isArabic} />
            {otherSystemLines.length > 0 ? (
              <LineTable title={t('System charges', 'رسوم النظام')} lines={otherSystemLines} isArabic={isArabic} />
            ) : null}
            <LineTable title={t('Order charges (VAS)', 'رسوم الطلبات')} lines={orderChargeLines(lines)} isArabic={isArabic} />
            <LineTable
              title={t('Additional charges', 'رسوم إضافية')}
              lines={manualLines(lines)}
              showActions={canMutate && isEditable}
              onRemove={(lineId) => removeLineMut.mutate(lineId)}
              removingId={removeLineMut.isPending ? removeLineMut.variables : undefined}
              isArabic={isArabic}
            />

            {canMutate && isEditable ? (
              <form className="mt-4 grid gap-3 border-t pt-4 sm:grid-cols-4" onSubmit={handleAddManualLine}>
                <div className="space-y-2 sm:col-span-2">
                  <Label>{t('Description', 'الوصف')}</Label>
                  <Input value={manualDesc} onChange={(e) => setManualDesc(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>{t('Qty', 'الكمية')}</Label>
                  <Input type="number" min={0} step="0.01" value={manualQty} onChange={(e) => setManualQty(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>{t('Unit price', 'سعر الوحدة')}</Label>
                  <Input type="number" min={0} step="0.01" value={manualUnit} onChange={(e) => setManualUnit(e.target.value)} />
                </div>
                <div className="sm:col-span-4">
                  <Button type="submit" size="sm" disabled={addLineMut.isPending}>
                    {t('Add charge', 'إضافة رسوم')}
                  </Button>
                </div>
              </form>
            ) : null}

            <div className="mt-6 space-y-2 border-t pt-4 text-sm">
              <div className="flex justify-between">
                <span>{t('Subtotal', 'المجموع الفرعي')}</span>
                <span className="font-mono tabular-nums">
                  {formatDecimal(invoice.subtotalAmount)} {BILLING_CURRENCY}
                </span>
              </div>
              <div className="flex justify-between">
                <span>{t('Discount', 'الخصم')}</span>
                <span className="font-mono tabular-nums">
                  -{formatDecimal(invoice.discountAmount)} {BILLING_CURRENCY}
                </span>
              </div>
              <div className="flex justify-between">
                <span>
                  {t('VAT', 'ضريبة')} ({formatDecimal(invoice.vatPercentage, 2)}%)
                </span>
                <span className="font-mono tabular-nums">
                  {formatDecimal(invoice.vatAmount)} {BILLING_CURRENCY}
                </span>
              </div>
              <div className="flex justify-between border-t pt-2 text-base font-semibold">
                <span>{t('Grand total', 'الإجمالي')}</span>
                <span className="font-mono tabular-nums">
                  {formatDecimal(invoice.grandTotal)} {BILLING_CURRENCY}
                </span>
              </div>
            </div>

            {canMutate && isEditable ? (
              <form
                className="mt-4 grid gap-3 border-t pt-4 sm:grid-cols-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  updateInvoiceMut.mutate()
                }}
              >
                <div className="space-y-2">
                  <Label>{t('Discount type', 'نوع الخصم')}</Label>
                  <Select
                    value={discountType || '__none__'}
                    onValueChange={(v) => setDiscountType(v === '__none__' ? '' : (v as 'fixed' | 'percentage'))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">{t('None', 'لا شيء')}</SelectItem>
                      <SelectItem value="fixed">{t('Fixed amount', 'مبلغ ثابت')}</SelectItem>
                      <SelectItem value="percentage">{t('Percentage', 'نسبة')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t('Discount value', 'قيمة الخصم')}</Label>
                  <Input type="number" min={0} step="0.01" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>{t('VAT %', 'ضريبة %')}</Label>
                  <Input type="number" min={0} step="0.01" value={vatPercentage} onChange={(e) => setVatPercentage(e.target.value)} />
                </div>
                <div className="sm:col-span-2">
                  <Button type="submit" size="sm" variant="secondary" disabled={updateInvoiceMut.isPending}>
                    {t('Save discounts & VAT', 'حفظ الخصم والضريبة')}
                  </Button>
                </div>
              </form>
            ) : null}
          </section>
        </>
      ) : null}
    </div>
  )
}
