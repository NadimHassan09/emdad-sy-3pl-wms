import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router'
import { useUiPreferences } from '@emdad/core'
import { PageHeader, useNavigate } from '@emdad/ui'
import { Alert, AlertDescription, AlertTitle } from '@emdad/ui/ui/alert'
import { Button } from '@emdad/ui/ui/button'
import { Card, CardContent } from '@emdad/ui/ui/card'
import { Checkbox } from '@emdad/ui/ui/checkbox'
import { Combobox } from '@emdad/ui/ui/combobox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@emdad/ui/ui/dialog'
import { Input } from '@emdad/ui/ui/input'
import { Label } from '@emdad/ui/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@emdad/ui/ui/select'
import { Skeleton } from '@emdad/ui/ui/skeleton'
import { toast } from 'sonner'
import {
  BillingApi,
  type BillingApplyMode,
  type BillingPlanType,
  type UpdateBillingPlanPayload,
} from '@/api/billing'
import { useAuth } from '@/auth/AuthContext'
import { QK } from '@/constants/query-keys'
import { BillingFormSection, numField } from './billing-form'
import { BILLING_CURRENCY, canMutateBilling } from './billing-ui'

const FORM_ID = 'billing-plan-edit-form'

export function BillingPlanEditPage() {
  const { clientId = '' } = useParams<{ clientId: string }>()
  const { isArabic } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { user } = useAuth()
  const canMutate = canMutateBilling(user?.role)

  const [planType, setPlanType] = useState<BillingPlanType>('custom')
  const [templateId, setTemplateId] = useState('')
  const [reservedVolume, setReservedVolume] = useState('0')
  const [fixedSubscriptionFee, setFixedSubscriptionFee] = useState('0')
  const [inboundOrderFee, setInboundOrderFee] = useState('0')
  const [outboundOrderFee, setOutboundOrderFee] = useState('0')
  const [cycleLengthDays, setCycleLengthDays] = useState('30')
  const [autoRenew, setAutoRenew] = useState(true)
  const [applyModalOpen, setApplyModalOpen] = useState(false)
  const [pendingPayload, setPendingPayload] = useState<UpdateBillingPlanPayload | null>(null)

  const detailQuery = useQuery({
    queryKey: QK.billing.planDetail(clientId),
    queryFn: () => BillingApi.getPlanDetailByClient(clientId),
    enabled: !!clientId && canMutate,
  })

  const templatesQuery = useQuery({
    queryKey: [...QK.billing.templates, 'active'],
    queryFn: () => BillingApi.listTemplates({ activeOnly: true }),
    enabled: canMutate,
  })

  const plan = detailQuery.data?.plan ?? null
  const company = detailQuery.data?.company

  useEffect(() => {
    if (!plan) return
    setPlanType(plan.planType === 'template' ? 'template' : 'custom')
    setTemplateId(plan.templateId ?? '')
    setReservedVolume(plan.reservedVolume)
    setFixedSubscriptionFee(plan.fixedSubscriptionFee)
    setInboundOrderFee(plan.inboundOrderFee)
    setOutboundOrderFee(plan.outboundOrderFee)
    setCycleLengthDays(String(plan.cycleLengthDays))
    setAutoRenew(plan.autoRenew !== false)
  }, [plan])

  const templateOptions = useMemo(
    () => (templatesQuery.data ?? []).map((tpl) => ({ value: tpl.id, label: tpl.name })),
    [templatesQuery.data],
  )

  const selectedTemplate = useMemo(
    () => (templatesQuery.data ?? []).find((tpl) => tpl.id === templateId) ?? null,
    [templatesQuery.data, templateId],
  )

  useEffect(() => {
    if (planType !== 'template' || !selectedTemplate) return
    setReservedVolume(selectedTemplate.reservedVolume)
    setFixedSubscriptionFee(selectedTemplate.fixedSubscriptionFee)
    setCycleLengthDays(String(selectedTemplate.cycleLengthDays))
  }, [planType, selectedTemplate])

  const updateMut = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateBillingPlanPayload }) =>
      BillingApi.updatePlan(id, payload),
    onSuccess: () => {
      toast.success(t('Billing plan updated.', 'تم تحديث خطة الفوترة.'))
      setApplyModalOpen(false)
      setPendingPayload(null)
      void qc.invalidateQueries({ queryKey: QK.billing.plans })
      void qc.invalidateQueries({ queryKey: QK.billing.planDetail(clientId) })
      void qc.invalidateQueries({ queryKey: QK.billing.capacity })
      navigate(`/billing/plans/${clientId}`)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const fieldsReadOnly = planType === 'template'

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!plan) return
    if (planType === 'template' && !templateId) {
      toast.error(t('Select a plan template.', 'اختر قالباً.'))
      return
    }
    const payload: UpdateBillingPlanPayload = {
      planType,
      templateId: planType === 'template' ? templateId : null,
      reservedVolume: numField(reservedVolume),
      fixedSubscriptionFee: numField(fixedSubscriptionFee),
      inboundOrderFee: numField(inboundOrderFee),
      outboundOrderFee: numField(outboundOrderFee),
      outboundBaseFee: numField(outboundOrderFee),
      cycleLengthDays: Math.max(1, Math.floor(numField(cycleLengthDays)) || 30),
      autoRenew,
    }
    setPendingPayload(payload)
    setApplyModalOpen(true)
  }

  const applyWithMode = (applyMode: BillingApplyMode) => {
    if (!plan || !pendingPayload) return
    updateMut.mutate({ id: plan.id, payload: { ...pendingPayload, applyMode } })
  }

  if (!canMutate) {
    return (
      <Alert variant="destructive">
        <AlertTitle>{t('Access denied', 'الوصول مرفوض')}</AlertTitle>
        <AlertDescription>{t('You cannot edit billing plans.', 'لا يمكنك تعديل خطط الفوترة.')}</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={company ? t(`Edit plan — ${company.name}`, `تعديل الخطة — ${company.name}`) : t('Edit billing plan', 'تعديل خطة الفوترة')}
        description={t('Update volume, fees, and billing cycle.', 'تحديث الحجم والرسوم ودورة الفوترة.')}
        actions={
          plan ? (
            <>
              <Button type="button" variant="outline" onClick={() => navigate(`/billing/plans/${clientId}`)}>
                {t('Cancel', 'إلغاء')}
              </Button>
              <Button type="submit" form={FORM_ID} disabled={updateMut.isPending}>
                {t('Save changes', 'حفظ التغييرات')}
              </Button>
            </>
          ) : undefined
        }
      />

      {detailQuery.isPending ? (
        <Card>
          <CardContent className="space-y-3 pt-6">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      ) : null}

      {detailQuery.isError ? (
        <Alert variant="destructive">
          <AlertTitle>{t('Could not load plan', 'تعذر تحميل الخطة')}</AlertTitle>
          <AlertDescription>{(detailQuery.error as Error).message}</AlertDescription>
        </Alert>
      ) : null}

      {!plan && !detailQuery.isPending ? (
        <Alert>
          <AlertTitle>{t('No billing plan', 'لا توجد خطة')}</AlertTitle>
          <AlertDescription>{t('This client has no plan to edit.', 'لا توجد خطة لهذا العميل.')}</AlertDescription>
        </Alert>
      ) : null}

      {plan ? (
        <form id={FORM_ID} onSubmit={handleSubmit}>
          <Card>
            <CardContent className="space-y-6 pt-6">
              <BillingFormSection title={t('Plan mode', 'نوع الخطة')}>
                <div className="space-y-2">
                  <Label>{t('Plan mode', 'نوع الخطة')}</Label>
                  <Select
                    value={planType}
                    onValueChange={(v) => {
                      const next = v as BillingPlanType
                      setPlanType(next)
                      if (next === 'custom') setTemplateId('')
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="custom">{t('Custom', 'مخصص')}</SelectItem>
                      <SelectItem value="template">{t('Template', 'قالب')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {planType === 'template' ? (
                  <div className="space-y-2">
                    <Label>{t('Template', 'القالب')}</Label>
                    <Combobox
                      value={templateId}
                      onChange={setTemplateId}
                      options={templateOptions}
                      placeholder={t('Select template…', 'اختر قالباً…')}
                    />
                  </div>
                ) : (
                  <div />
                )}
              </BillingFormSection>

              <BillingFormSection title={t('Billing terms', 'شروط الفوترة')} bordered={false}>
                <div className="space-y-2">
                  <Label>{t('Reserved volume (m³)', 'الحجم المحجوز (م³)')}</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={reservedVolume}
                    onChange={(e) => setReservedVolume(e.target.value)}
                    disabled={fieldsReadOnly}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t(`Fixed plan price (${BILLING_CURRENCY})`, `سعر الخطة (${BILLING_CURRENCY})`)}</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={fixedSubscriptionFee}
                    onChange={(e) => setFixedSubscriptionFee(e.target.value)}
                    disabled={fieldsReadOnly}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t(`Inbound order price (${BILLING_CURRENCY})`, `سعر الوارد (${BILLING_CURRENCY})`)}</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={inboundOrderFee}
                    onChange={(e) => setInboundOrderFee(e.target.value)}
                    disabled={fieldsReadOnly}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t(`Outbound order price (${BILLING_CURRENCY})`, `سعر الصادر (${BILLING_CURRENCY})`)}</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={outboundOrderFee}
                    onChange={(e) => setOutboundOrderFee(e.target.value)}
                    disabled={fieldsReadOnly}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('Billing cycle (days)', 'دورة الفوترة (أيام)')}</Label>
                  <Input
                    type="number"
                    min={1}
                    value={cycleLengthDays}
                    onChange={(e) => setCycleLengthDays(e.target.value)}
                    disabled={fieldsReadOnly}
                    required
                  />
                </div>
                <label className="flex items-start gap-2.5 sm:col-span-2">
                  <Checkbox checked={autoRenew} onCheckedChange={(v) => setAutoRenew(v === true)} className="mt-1" />
                  <span className="text-sm">{t('Auto-renewal', 'تجديد تلقائي')}</span>
                </label>
              </BillingFormSection>
            </CardContent>
          </Card>
        </form>
      ) : null}

      <Dialog open={applyModalOpen} onOpenChange={(o) => !updateMut.isPending && setApplyModalOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('When should this change take effect?', 'متى يُطبَّق التغيير؟')}</DialogTitle>
            <DialogDescription>
              {t(
                'Apply immediately refreshes the active cycle rates. Apply next cycle updates the plan only.',
                'التطبيق الفوري يحدّث أسعار الدورة النشطة. التطبيق من الدورة التالية يحدّث الخطة فقط.',
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button type="button" variant="outline" onClick={() => setApplyModalOpen(false)}>
              {t('Cancel', 'إلغاء')}
            </Button>
            <Button type="button" variant="secondary" disabled={updateMut.isPending} onClick={() => applyWithMode('next_cycle')}>
              {t('Next cycle', 'الدورة التالية')}
            </Button>
            <Button type="button" disabled={updateMut.isPending} onClick={() => applyWithMode('immediate')}>
              {t('Immediately', 'فوراً')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
