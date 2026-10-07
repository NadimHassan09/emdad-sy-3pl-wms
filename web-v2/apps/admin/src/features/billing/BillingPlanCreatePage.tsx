import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useUiPreferences } from '@emdad/core'
import { PageHeader, useNavigate } from '@emdad/ui'
import { Alert, AlertDescription, AlertTitle } from '@emdad/ui/ui/alert'
import { Button } from '@emdad/ui/ui/button'
import { Card, CardContent } from '@emdad/ui/ui/card'
import { Checkbox } from '@emdad/ui/ui/checkbox'
import { Combobox } from '@emdad/ui/ui/combobox'
import { Input } from '@emdad/ui/ui/input'
import { Label } from '@emdad/ui/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@emdad/ui/ui/select'
import { toast } from 'sonner'
import { BillingApi, type BillingPlanType, type CreateBillingPlanPayload } from '@/api/billing'
import { useAuth } from '@/auth/AuthContext'
import { QK } from '@/constants/query-keys'
import { BillingFormSection, numField } from './billing-form'
import { BILLING_CURRENCY, canMutateBilling } from './billing-ui'

const FORM_ID = 'billing-plan-create-form'

export function BillingPlanCreatePage() {
  const { isArabic } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { user } = useAuth()
  const canMutate = canMutateBilling(user?.role)

  const [companyId, setCompanyId] = useState('')
  const [clientSearch, setClientSearch] = useState('')
  const [planType, setPlanType] = useState<BillingPlanType>('custom')
  const [templateId, setTemplateId] = useState('')
  const [reservedVolume, setReservedVolume] = useState('0')
  const [fixedSubscriptionFee, setFixedSubscriptionFee] = useState('0')
  const [inboundOrderFee, setInboundOrderFee] = useState('0')
  const [outboundOrderFee, setOutboundOrderFee] = useState('0')
  const [cycleLengthDays, setCycleLengthDays] = useState('30')
  const [autoRenew, setAutoRenew] = useState(true)

  const companiesQuery = useQuery({
    queryKey: [...QK.billing.companiesWithoutPlan, clientSearch],
    queryFn: () => BillingApi.listCompaniesWithoutPlan(clientSearch),
    enabled: canMutate,
  })

  const templatesQuery = useQuery({
    queryKey: [...QK.billing.templates, 'active'],
    queryFn: () => BillingApi.listTemplates({ activeOnly: true }),
    enabled: canMutate,
  })

  const companyOptions = useMemo(() => {
    const q = clientSearch.trim().toLowerCase()
    return (companiesQuery.data ?? [])
      .filter((c) => !q || c.name.toLowerCase().includes(q))
      .map((c) => ({ value: c.id, label: c.name }))
  }, [companiesQuery.data, clientSearch])

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

  const createMut = useMutation({
    mutationFn: (payload: CreateBillingPlanPayload) => BillingApi.createPlan(payload),
    onSuccess: (plan) => {
      toast.success(t('Billing plan created.', 'تم إنشاء خطة الفوترة.'))
      void qc.invalidateQueries({ queryKey: QK.billing.plans })
      void qc.invalidateQueries({ queryKey: QK.billing.companiesWithoutPlan })
      void qc.invalidateQueries({ queryKey: QK.billing.capacity })
      navigate(`/billing/plans/${plan.companyId}`)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const fieldsReadOnly = planType === 'template'

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!companyId) {
      toast.error(t('Select a client.', 'اختر عميلاً.'))
      return
    }
    if (planType === 'template' && !templateId) {
      toast.error(t('Select a plan template.', 'اختر قالباً.'))
      return
    }
    const cycleDays = Math.max(1, Math.floor(numField(cycleLengthDays)) || 30)
    const payload: CreateBillingPlanPayload = {
      companyId,
      planType,
      cycleLengthDays: cycleDays,
      reservedVolume: numField(reservedVolume),
      fixedSubscriptionFee: numField(fixedSubscriptionFee),
      inboundOrderFee: numField(inboundOrderFee),
      outboundOrderFee: numField(outboundOrderFee),
      outboundBaseFee: numField(outboundOrderFee),
      autoRenew,
    }
    if (planType === 'template') payload.templateId = templateId
    createMut.mutate(payload)
  }

  if (!canMutate) {
    return (
      <Alert variant="destructive">
        <AlertTitle>{t('Access denied', 'الوصول مرفوض')}</AlertTitle>
        <AlertDescription>{t('You cannot create billing plans.', 'لا يمكنك إنشاء خطط فوترة.')}</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('Create billing plan', 'إنشاء خطة فوترة')}
        description={t(
          'Assign a subscription plan to a client without an active plan.',
          'تعيين خطة اشتراك لعميل بدون خطة نشطة.',
        )}
        actions={
          <>
            <Button type="button" variant="outline" onClick={() => navigate('/billing/plans')}>
              {t('Cancel', 'إلغاء')}
            </Button>
            <Button type="submit" form={FORM_ID} disabled={createMut.isPending}>
              {t('Create plan', 'إنشاء الخطة')}
            </Button>
          </>
        }
      />

      <form id={FORM_ID} onSubmit={handleSubmit}>
        <Card>
          <CardContent className="space-y-6 pt-6">
            <BillingFormSection
              title={t('Client & plan mode', 'العميل ونوع الخطة')}
              description={t(
                'Choose the client and custom or template-based terms.',
                'اختر العميل وما إذا كانت الخطة مخصصة أو من قالب.',
              )}
            >
              <div className="space-y-2 sm:col-span-2">
                <Label>{t('Client', 'العميل')}</Label>
                <Combobox
                  value={companyId}
                  onChange={setCompanyId}
                  options={companyOptions}
                  placeholder={t('Search clients without a plan…', 'ابحث عن عميل بلا خطة…')}
                  searchPlaceholder={t('Search…', 'بحث…')}
                  emptyLabel={t('No clients found', 'لا عملاء')}
                />
                <Input
                  className="mt-2"
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  placeholder={t('Filter client list…', 'تصفية قائمة العملاء…')}
                />
              </div>
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
                    emptyLabel={t('No templates', 'لا قوالب')}
                  />
                </div>
              ) : (
                <div />
              )}
            </BillingFormSection>

            <BillingFormSection
              title={t('Billing terms', 'شروط الفوترة')}
              description={
                planType === 'template'
                  ? t('Template fields are read-only.', 'حقول القالب للقراءة فقط.')
                  : t('Set volume, fees, and cycle length.', 'حدد الحجم والرسوم ومدة الدورة.')
              }
              bordered={false}
            >
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
                <Label>{t(`Inbound order price (${BILLING_CURRENCY})`, `سعر الطلب الوارد (${BILLING_CURRENCY})`)}</Label>
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
                <Label>{t(`Outbound order price (${BILLING_CURRENCY})`, `سعر الطلب الصادر (${BILLING_CURRENCY})`)}</Label>
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
                  step="1"
                  value={cycleLengthDays}
                  onChange={(e) => setCycleLengthDays(e.target.value)}
                  disabled={fieldsReadOnly}
                  required
                />
              </div>
              <label className="flex items-start gap-2.5 sm:col-span-2">
                <Checkbox checked={autoRenew} onCheckedChange={(v) => setAutoRenew(v === true)} className="mt-1" />
                <span>
                  <span className="block text-sm font-medium">{t('Auto-renewal', 'تجديد تلقائي')}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {t(
                      'When enabled, a new cycle starts automatically when the current one ends.',
                      'عند التفعيل، تبدأ دورة جديدة تلقائياً عند انتهاء الدورة الحالية.',
                    )}
                  </span>
                </span>
              </label>
            </BillingFormSection>
          </CardContent>
        </Card>
      </form>
    </div>
  )
}
