import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useUiPreferences } from '@emdad/core'
import { Button } from '@emdad/ui/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@emdad/ui/ui/dialog'
import { Input } from '@emdad/ui/ui/input'
import { Label } from '@emdad/ui/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@emdad/ui/ui/select'
import { Textarea } from '@emdad/ui/ui/textarea'
import {
  type CompanyListRow,
  type CompanyStatus,
  type CreateCompanyPayload,
  type UpdateCompanyPayload,
  CompaniesApi,
} from '@/api/companies'
import { adminMediaSrc } from '@/lib/admin-media'
import {
  sanitizeCompanyPayload,
  validateCompanyForm,
  type CompanyFormErrors,
} from '@/lib/company-form-validation'

const STATUS_OPTIONS: { value: CompanyStatus; en: string; ar: string }[] = [
  { value: 'active', en: 'Active', ar: 'نشط' },
  { value: 'paused', en: 'Paused', ar: 'موقوف' },
  { value: 'offboarding', en: 'Offboarding', ar: 'إنهاء' },
  { value: 'closed', en: 'Closed', ar: 'مغلق' },
]

type CreateProps = {
  open: boolean
  onClose: () => void
  loading: boolean
  onSubmit: (payload: CreateCompanyPayload, logoFile: File | null) => void
}

export function CreateCompanyDialog({ open, onClose, loading, onSubmit }: CreateProps) {
  const { isArabic } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const [form, setForm] = useState<CreateCompanyPayload>({
    name: '',
    contactEmail: '',
    tradeName: '',
    country: 'SA',
    city: '',
    contactPhone: '',
    address: '',
    notes: '',
  })
  const [errors, setErrors] = useState<CompanyFormErrors>({})
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setForm({
      name: '',
      contactEmail: '',
      tradeName: '',
      country: 'SA',
      city: '',
      contactPhone: '',
      address: '',
      notes: '',
    })
    setErrors({})
    setLogoFile(null)
  }, [open])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const fields = {
      name: form.name,
      tradeName: form.tradeName,
      contactEmail: form.contactEmail,
      country: form.country ?? '',
      city: form.city ?? '',
      contactPhone: form.contactPhone,
      address: form.address,
      notes: form.notes,
    }
    const nextErrors = validateCompanyForm(fields, { isArabic, requireCity: true })
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    const clean = sanitizeCompanyPayload(fields)
    onSubmit(
      {
        name: clean.name,
        contactEmail: clean.contactEmail,
        country: clean.country,
        city: clean.city,
        ...(clean.tradeName ? { tradeName: clean.tradeName } : {}),
        ...(clean.contactPhone ? { contactPhone: clean.contactPhone } : {}),
        ...(clean.address ? { address: clean.address } : {}),
        ...(clean.notes ? { notes: clean.notes } : {}),
      },
      logoFile,
    )
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !loading && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('New company', 'شركة جديدة')}</DialogTitle>
        </DialogHeader>
        <form id="create-company" onSubmit={submit} className="space-y-3">
          <LogoField
            t={t}
            file={logoFile}
            onPick={() => fileRef.current?.click()}
            onClear={() => setLogoFile(null)}
            inputRef={fileRef}
            onFile={(f) => setLogoFile(f)}
          />
          <Field label={t('Name', 'الاسم')} required error={errors.name}>
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </Field>
          <Field label={t('Trade name (optional)', 'الاسم التجاري')} error={errors.tradeName}>
            <Input
              value={form.tradeName ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, tradeName: e.target.value }))}
            />
          </Field>
          <Field label={t('Contact email', 'البريد')} required error={errors.contactEmail}>
            <Input
              type="email"
              value={form.contactEmail}
              onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))}
            />
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={t('Country', 'الدولة')} required error={errors.country}>
              <Input
                value={form.country ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
              />
            </Field>
            <Field label={t('City', 'المدينة')} required error={errors.city}>
              <Input value={form.city ?? ''} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
            </Field>
          </div>
          <Field label={t('Phone (optional)', 'الهاتف')} error={errors.contactPhone}>
            <Input
              value={form.contactPhone ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, contactPhone: e.target.value }))}
            />
          </Field>
          <Field label={t('Address (optional)', 'العنوان')} error={errors.address}>
            <Textarea
              value={form.address ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              rows={2}
            />
          </Field>
          <Field label={t('Notes (optional)', 'ملاحظات')} error={errors.notes}>
            <Textarea value={form.notes ?? ''} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} />
          </Field>
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            {t('Cancel', 'إلغاء')}
          </Button>
          <Button type="submit" form="create-company" disabled={loading}>
            {t('Create', 'إنشاء')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

type EditProps = {
  company: CompanyListRow | null
  onClose: () => void
  loading: boolean
  onSubmit: (id: string, payload: UpdateCompanyPayload) => void
  onLogoChange: () => void
}

export function EditCompanyDialog({ company, onClose, loading, onSubmit, onLogoChange }: EditProps) {
  const { isArabic } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const [form, setForm] = useState<UpdateCompanyPayload>({})
  const [errors, setErrors] = useState<CompanyFormErrors>({})
  const [logoUploading, setLogoUploading] = useState(false)
  const [logoVersion, setLogoVersion] = useState(() => Date.now())
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!company) return
    setForm({
      name: company.name,
      tradeName: company.tradeName ?? '',
      contactEmail: company.contactEmail,
      country: company.country ?? 'SA',
      city: company.city ?? '',
      contactPhone: company.contactPhone ?? '',
      address: company.address ?? '',
      notes: company.notes ?? '',
      status: company.status,
    })
    setErrors({})
    setLogoVersion(Date.now())
  }, [company])

  if (!company) return null

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const fields = {
      name: form.name ?? '',
      tradeName: form.tradeName,
      contactEmail: form.contactEmail ?? '',
      country: form.country ?? '',
      city: form.city ?? '',
      contactPhone: form.contactPhone,
      address: form.address,
      notes: form.notes,
    }
    const nextErrors = validateCompanyForm(fields, { isArabic, requireCity: true })
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    const clean = sanitizeCompanyPayload(fields)
    onSubmit(company.id, {
      name: clean.name,
      contactEmail: clean.contactEmail,
      country: clean.country,
      city: clean.city,
      tradeName: clean.tradeName ?? null,
      contactPhone: clean.contactPhone ?? null,
      address: clean.address ?? null,
      notes: clean.notes ?? null,
      status: form.status,
    })
  }

  const preview = adminMediaSrc(company.logoUrl, logoVersion)

  return (
    <Dialog open onOpenChange={(v) => !v && !loading && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {t('Edit', 'تعديل')} {company.name}
          </DialogTitle>
        </DialogHeader>
        <form id="edit-company" onSubmit={submit} className="space-y-3">
          <div className="space-y-2">
            <Label>{t('Company logo', 'الشعار')}</Label>
            <div className="flex items-center gap-3">
              {preview ? (
                <img src={preview} alt="" className="size-14 rounded-lg border object-cover" />
              ) : (
                <div className="flex size-14 items-center justify-center rounded-lg bg-muted text-muted-foreground text-xs">
                  —
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={logoUploading || loading}
                  onClick={() => fileRef.current?.click()}
                >
                  {t('Upload', 'رفع')}
                </Button>
                {company.logoUrl ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={logoUploading || loading}
                    onClick={async () => {
                      setLogoUploading(true)
                      try {
                        await CompaniesApi.deleteLogo(company.id)
                        setLogoVersion(Date.now())
                        onLogoChange()
                      } finally {
                        setLogoUploading(false)
                      }
                    }}
                  >
                    {t('Remove', 'إزالة')}
                  </Button>
                ) : null}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  e.target.value = ''
                  if (!file) return
                  setLogoUploading(true)
                  try {
                    await CompaniesApi.uploadLogo(company.id, file)
                    setLogoVersion(Date.now())
                    onLogoChange()
                  } finally {
                    setLogoUploading(false)
                  }
                }}
              />
            </div>
          </div>
          <Field label={t('Status', 'الحالة')}>
            <Select
              value={form.status ?? company.status}
              onValueChange={(v) => setForm((f) => ({ ...f, status: v as CompanyStatus }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {isArabic ? o.ar : o.en}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={t('Name', 'الاسم')} required error={errors.name}>
            <Input value={form.name ?? ''} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </Field>
          <Field label={t('Trade name', 'الاسم التجاري')} error={errors.tradeName}>
            <Input
              value={(form.tradeName as string) ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, tradeName: e.target.value }))}
            />
          </Field>
          <Field label={t('Contact email', 'البريد')} required error={errors.contactEmail}>
            <Input
              type="email"
              value={form.contactEmail ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))}
            />
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={t('Country', 'الدولة')} required error={errors.country}>
              <Input
                value={form.country ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
              />
            </Field>
            <Field label={t('City', 'المدينة')} required error={errors.city}>
              <Input value={form.city ?? ''} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
            </Field>
          </div>
          <Field label={t('Phone', 'الهاتف')} error={errors.contactPhone}>
            <Input
              value={form.contactPhone ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, contactPhone: e.target.value }))}
            />
          </Field>
          <Field label={t('Address', 'العنوان')} error={errors.address}>
            <Textarea
              value={form.address ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              rows={2}
            />
          </Field>
          <Field label={t('Notes', 'ملاحظات')} error={errors.notes}>
            <Textarea value={form.notes ?? ''} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} />
          </Field>
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            {t('Cancel', 'إلغاء')}
          </Button>
          <Button type="submit" form="edit-company" disabled={loading}>
            {t('Save', 'حفظ')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string
  required?: boolean
  error?: string
  children: ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label>
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}

function LogoField({
  t,
  file,
  previewUrl,
  onPick,
  onClear,
  inputRef,
  onFile,
}: {
  t: (en: string, ar: string) => string
  file?: File | null
  previewUrl?: string | null
  onPick: () => void
  onClear: () => void
  inputRef: React.RefObject<HTMLInputElement | null>
  onFile: (f: File) => void
}) {
  const objectUrl = file ? URL.createObjectURL(file) : null
  const src = objectUrl ?? previewUrl
  return (
    <div className="space-y-2">
      <Label>{t('Company logo (optional)', 'الشعار (اختياري)')}</Label>
      <div className="flex items-center gap-3">
        {src ? <img src={src} alt="" className="size-14 rounded-lg border object-cover" /> : null}
        <Button type="button" variant="outline" size="sm" onClick={onPick}>
          {t('Choose file', 'اختر ملف')}
        </Button>
        {file ? (
          <Button type="button" variant="ghost" size="sm" onClick={onClear}>
            {t('Clear', 'مسح')}
          </Button>
        ) : null}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) onFile(f)
        }}
      />
    </div>
  )
}
