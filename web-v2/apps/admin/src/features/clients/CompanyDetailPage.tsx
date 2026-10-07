import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { useUiPreferences } from '@emdad/core'
import { PageHeader } from '@emdad/ui'
import { Alert, AlertDescription, AlertTitle } from '@emdad/ui/ui/alert'
import { Button } from '@emdad/ui/ui/button'
import { Skeleton } from '@emdad/ui/ui/skeleton'
import { CompaniesApi } from '@/api/companies'
import { QK } from '@/constants/query-keys'
import { CompanyDetailsCard } from './CompanyDetailsCard'

export function CompanyDetailPage() {
  const { id = '' } = useParams()
  const { isArabic, locale } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)

  const companyQuery = useQuery({
    queryKey: [...QK.companies, id],
    queryFn: () => CompaniesApi.get(id),
    enabled: !!id,
  })

  const company = companyQuery.data

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" className="-ms-2 w-fit" asChild>
        <Link to="/clients">
          <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
          {t('Back to clients', 'العودة للعملاء')}
        </Link>
      </Button>

      <PageHeader
        title={company?.name ?? t('Company details', 'تفاصيل الشركة')}
        description={company?.contactEmail ?? undefined}
      />

      {companyQuery.isPending ? (
        <div className="space-y-3 rounded-xl border p-6" aria-busy>
          <Skeleton className="h-7 w-2/5" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : null}

      {companyQuery.isError ? (
        <Alert variant="destructive">
          <AlertTitle>{t('Could not load company.', 'تعذر التحميل.')}</AlertTitle>
        </Alert>
      ) : null}

      {!companyQuery.isPending && !companyQuery.isError && !company ? (
        <Alert variant="destructive">
          <AlertDescription>{t('Company not found.', 'الشركة غير موجودة.')}</AlertDescription>
        </Alert>
      ) : null}

      {company ? <CompanyDetailsCard company={company} isArabic={isArabic} locale={locale} /> : null}
    </div>
  )
}
