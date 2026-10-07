import type { ReactNode } from 'react'
import { Building2, Mail, Phone, MapPin, Globe, FileText } from 'lucide-react'
import type { CompanyListRow } from '@/api/companies'
import { adminMediaSrc } from '@/lib/admin-media'
import { CompanyStatusBadge } from './clients-ui'

function display(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return '—'
  const s = String(v).trim()
  return s.length ? s : '—'
}

function prettyDate(value: string, locale?: string): string {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(d)
}

function Field({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-1.5 text-sm font-semibold">{value}</div>
    </div>
  )
}

export function CompanyDetailsCard({
  company,
  isArabic,
  locale,
}: {
  company: CompanyListRow
  isArabic: boolean
  locale?: string
}) {
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const logo = adminMediaSrc(company.logoUrl)
  const summaryText = company.notes?.trim() ?? ''

  return (
    <section className="overflow-hidden rounded-xl border bg-card p-6 shadow-sm">
      <div className="flex items-start gap-4">
        {logo ? (
          <img src={logo} alt="" className="size-14 shrink-0 rounded-full object-cover ring-4 ring-muted" />
        ) : (
          <div
            className="flex size-14 shrink-0 items-center justify-center rounded-full bg-muted ring-4 ring-muted"
            aria-hidden
          >
            <Building2 className="size-6 text-muted-foreground" />
          </div>
        )}
        <div className="min-w-0 flex-1 pt-0.5">
          <h2 className="text-lg font-semibold leading-tight">{company.name}</h2>
          <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-muted-foreground">
            {company.tradeName ? <span>{company.tradeName}</span> : null}
            {company.tradeName ? <span aria-hidden>·</span> : null}
            <CompanyStatusBadge status={company.status} isArabic={isArabic} />
          </p>
        </div>
      </div>

      <h3 className="mt-6 text-sm font-semibold">{t('Company information', 'معلومات الشركة')}</h3>
      <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <Field icon={<Mail className="size-3.5" />} label={t('Contact email', 'البريد')} value={company.contactEmail} />
        <Field icon={<Phone className="size-3.5" />} label={t('Phone', 'الهاتف')} value={display(company.contactPhone)} />
        <Field icon={<MapPin className="size-3.5" />} label={t('City', 'المدينة')} value={display(company.city)} />
        <Field icon={<Globe className="size-3.5" />} label={t('Country', 'الدولة')} value={display(company.country)} />
        <Field
          icon={<FileText className="size-3.5" />}
          label={t('Billing', 'الفوترة')}
          value={`${company.billingCycle} · ${company.paymentTermsDays} ${t('days', 'يوم')}`}
        />
        <Field icon={<MapPin className="size-3.5" />} label={t('Address', 'العنوان')} value={display(company.address)} />
      </div>

      <div className="mt-6 flex items-center gap-2">
        <FileText className="size-4 text-muted-foreground" aria-hidden />
        <h3 className="text-sm font-semibold">{t('Summary', 'ملخص')}</h3>
      </div>
      <div className="mt-3 rounded-lg bg-muted/50 px-4 py-3.5 text-sm leading-relaxed">
        {summaryText || <span className="text-muted-foreground">{t('No notes for this company.', 'لا ملاحظات.')}</span>}
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        {t('Created', 'أُنشئ')} {prettyDate(company.createdAt, locale)} · {t('Updated', 'حدّث')}{' '}
        {prettyDate(company.updatedAt, locale)}
      </p>
    </section>
  )
}
