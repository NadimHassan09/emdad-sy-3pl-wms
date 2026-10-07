import { Link } from 'react-router'
import { SearchX } from 'lucide-react'
import { useUiPreferences } from '@emdad/core'
import { EmptyState } from '@emdad/ui'
import { Button } from '@emdad/ui/ui/button'

export function NotFoundPage() {
  const { isArabic } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  return (
    <div className="rounded-xl border bg-card">
      <EmptyState
        icon={SearchX}
        title={t('Page not found', 'الصفحة غير موجودة')}
        description={t('The page you are looking for does not exist or was moved.', 'الصفحة المطلوبة غير موجودة أو تم نقلها.')}
        action={
          <Button asChild>
            <Link to="/dashboard">{t('Back to dashboard', 'العودة إلى لوحة التحكم')}</Link>
          </Button>
        }
      />
    </div>
  )
}
