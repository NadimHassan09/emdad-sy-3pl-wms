import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useUiPreferences } from '@emdad/core'
import { Button } from '@emdad/ui/ui/button'
import { Combobox } from '@emdad/ui/ui/combobox'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@emdad/ui/ui/dialog'
import { Input } from '@emdad/ui/ui/input'
import { Label } from '@emdad/ui/ui/label'
import { toast } from 'sonner'
import { CompaniesApi } from '@/api/companies'
import {
  FinalContractsApi,
  type CreateFinalContractInput,
  type FinalContractRow,
} from '@/api/final-contracts'
import { QK } from '@/constants/query-keys'
import { companyFilterComboboxOptions } from '@/lib/company-filter-options'
import { localCalendarDateYmd } from '@/lib/order-planning-dates'

const DEFAULT_RATES = {
  rateStorage: 25,
  rateInboundHandling: 8,
  rateOutboundHandling: 12,
  rateValueAddedServices: 15,
  rateReturnProcessing: 10,
}

export function CreateFinalContractDialog({
  open,
  onClose,
  onSaved,
  contract,
}: {
  open: boolean
  onClose: () => void
  onSaved: () => void
  contract?: FinalContractRow | null
}) {
  const isEdit = !!contract
  const { isArabic } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)

  const [companyId, setCompanyId] = useState('')
  const [issueDate, setIssueDate] = useState(localCalendarDateYmd())
  const [clientCompanyName, setClientCompanyName] = useState('')
  const [clientCompanyType, setClientCompanyType] = useState('')
  const [clientAddress, setClientAddress] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [clientEmail, setClientEmail] = useState('')
  const [clientTaxId, setClientTaxId] = useState('')
  const [clientSignatoryName, setClientSignatoryName] = useState('')
  const [clientSignatoryTitle, setClientSignatoryTitle] = useState('')
  const [rates, setRates] = useState(DEFAULT_RATES)

  const companies = useQuery({
    queryKey: QK.companies,
    queryFn: () => CompaniesApi.list(),
    staleTime: 10 * 60_000,
    enabled: open,
  })

  const companyOptions = useMemo(
    () => companyFilterComboboxOptions(companies.data, t('Select client…', 'اختر العميل…')),
    [companies.data, isArabic], // eslint-disable-line react-hooks/exhaustive-deps
  )

  const selectedCompany = useMemo(
    () => companies.data?.find((c) => c.id === companyId),
    [companies.data, companyId],
  )

  useEffect(() => {
    if (!selectedCompany || isEdit) return
    setClientCompanyName(selectedCompany.name)
    setClientAddress(selectedCompany.address ?? '')
    setClientPhone(selectedCompany.contactPhone ?? '')
    setClientEmail(selectedCompany.contactEmail ?? '')
  }, [selectedCompany, isEdit])

  useEffect(() => {
    if (!open) return
    if (contract) {
      setCompanyId(contract.companyId)
      setIssueDate(contract.issueDate)
      setClientCompanyName(contract.clientCompanyName)
      setClientCompanyType(contract.clientCompanyType ?? '')
      setClientAddress(contract.clientAddress ?? '')
      setClientPhone(contract.clientPhone ?? '')
      setClientEmail(contract.clientEmail ?? '')
      setClientTaxId(contract.clientTaxId ?? '')
      setClientSignatoryName(contract.clientSignatoryName ?? '')
      setClientSignatoryTitle(contract.clientSignatoryTitle ?? '')
      setRates({
        rateStorage: contract.rateStorage,
        rateInboundHandling: contract.rateInboundHandling,
        rateOutboundHandling: contract.rateOutboundHandling,
        rateValueAddedServices: contract.rateValueAddedServices,
        rateReturnProcessing: contract.rateReturnProcessing,
      })
      return
    }
    setCompanyId('')
    setIssueDate(localCalendarDateYmd())
    setClientCompanyName('')
    setClientCompanyType('')
    setClientAddress('')
    setClientPhone('')
    setClientEmail('')
    setClientTaxId('')
    setClientSignatoryName('')
    setClientSignatoryTitle('')
    setRates(DEFAULT_RATES)
  }, [open, contract])

  const saveMutation = useMutation({
    mutationFn: (input: CreateFinalContractInput) =>
      isEdit && contract ? FinalContractsApi.update(contract.id, input) : FinalContractsApi.create(input),
    onSuccess: () => {
      toast.success(
        isEdit
          ? t('Final contract updated.', 'تم تحديث العقد النهائي.')
          : t('Final contract created.', 'تم إنشاء العقد النهائي.'),
      )
      onSaved()
      onClose()
    },
    onError: (error: Error) => toast.error(error.message),
  })

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!companyId) {
      toast.error(t('Client is required.', 'العميل مطلوب.'))
      return
    }
    if (!clientCompanyName.trim()) {
      toast.error(t('Client company name is required.', 'اسم شركة العميل مطلوب.'))
      return
    }

    saveMutation.mutate({
      companyId,
      issueDate,
      clientCompanyName: clientCompanyName.trim(),
      clientCompanyType: clientCompanyType.trim() || undefined,
      clientAddress: clientAddress.trim() || undefined,
      clientPhone: clientPhone.trim() || undefined,
      clientEmail: clientEmail.trim() || undefined,
      clientTaxId: clientTaxId.trim() || undefined,
      clientSignatoryName: clientSignatoryName.trim() || undefined,
      clientSignatoryTitle: clientSignatoryTitle.trim() || undefined,
      ...rates,
    })
  }

  function rateField(key: keyof typeof DEFAULT_RATES, labelEn: string, labelAr: string) {
    return (
      <div key={key} className="space-y-2">
        <Label>{t(labelEn, labelAr)}</Label>
        <Input
          type="number"
          min={0}
          step="0.01"
          value={String(rates[key])}
          onChange={(e) => setRates((prev) => ({ ...prev, [key]: Number(e.target.value) || 0 }))}
        />
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit
              ? t('Edit final contract', 'تعديل العقد النهائي')
              : t('Create final contract', 'إنشاء العقد النهائي')}
          </DialogTitle>
        </DialogHeader>
        <form id="create-final-contract-form" onSubmit={handleSubmit} className="space-y-4">
          {isEdit && contract ? (
            <div className="space-y-2">
              <Label>{t('Contract #', 'رقم العقد')}</Label>
              <div className="rounded-md border bg-muted/40 px-3 py-2 font-mono text-sm">{contract.contractNumber}</div>
            </div>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t('Client', 'العميل')}</Label>
              <Combobox
                value={companyId}
                onChange={setCompanyId}
                options={companyOptions}
                placeholder={t('Select client…', 'اختر العميل…')}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('Issue date', 'تاريخ الإصدار')}</Label>
              <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} required />
            </div>
          </div>

          <div className="rounded-lg border p-4">
            <h3 className="mb-3 text-sm font-semibold">{t('Client details', 'بيانات العميل')}</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t('Company name', 'اسم الشركة')}</Label>
                <Input value={clientCompanyName} onChange={(e) => setClientCompanyName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>{t('Company type', 'نوع الشركة')}</Label>
                <Input
                  value={clientCompanyType}
                  onChange={(e) => setClientCompanyType(e.target.value)}
                  placeholder={t('e.g. Trading Company', 'مثال: شركة تجارية')}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>{t('Address', 'العنوان')}</Label>
                <Input value={clientAddress} onChange={(e) => setClientAddress(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{t('Phone', 'الهاتف')}</Label>
                <Input value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{t('Email', 'البريد الإلكتروني')}</Label>
                <Input type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{t('Tax ID', 'الرقم الضريبي')}</Label>
                <Input value={clientTaxId} onChange={(e) => setClientTaxId(e.target.value)} />
              </div>
            </div>
          </div>

          <div className="rounded-lg border p-4">
            <h3 className="mb-3 text-sm font-semibold">{t('Pricing & fees (USD)', 'التسعير والرسوم (USD)')}</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              {rateField('rateStorage', 'Storage (per pallet / month)', 'التخزين (لكل طبلية / شهر)')}
              {rateField('rateInboundHandling', 'Inbound handling (per pallet)', 'معالجة الوارد (لكل طبلية)')}
              {rateField('rateOutboundHandling', 'Outbound handling (per order)', 'معالجة الصادر (لكل طلب)')}
              {rateField(
                'rateValueAddedServices',
                'Value added services (per unit / hour)',
                'خدمات القيمة المضافة (لكل وحدة / ساعة)',
              )}
              {rateField('rateReturnProcessing', 'Return processing (per return)', 'معالجة المرتجعات (لكل مرتجع)')}
            </div>
          </div>

          <div className="rounded-lg border p-4">
            <h3 className="mb-3 text-sm font-semibold">{t('Client signatory', 'موقع العميل')}</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t('Signatory name', 'اسم الموقّع')}</Label>
                <Input value={clientSignatoryName} onChange={(e) => setClientSignatoryName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{t('Signatory title', 'المسمى الوظيفي')}</Label>
                <Input value={clientSignatoryTitle} onChange={(e) => setClientSignatoryTitle(e.target.value)} />
              </div>
            </div>
          </div>
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {t('Cancel', 'إلغاء')}
          </Button>
          <Button type="submit" form="create-final-contract-form" disabled={saveMutation.isPending}>
            {isEdit ? t('Save changes', 'حفظ التغييرات') : t('Create contract', 'إنشاء العقد')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
