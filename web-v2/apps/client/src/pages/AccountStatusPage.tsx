import { useState } from 'react'
import { Link } from 'react-router'
import { Check, Globe, Mail, Moon, ShieldAlert, Sun } from 'lucide-react'
import { useUiPreferences } from '@emdad/core'
import { AuthLayout } from '@emdad/ui'
import { Button } from '@emdad/ui/ui/button'

const SUPPORT_EMAIL = 'support@emdadsy.com'

export function AccountStatusPage() {
  const { isArabic, toggleLanguage, theme, toggleTheme } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(SUPPORT_EMAIL)
    } catch {
      /* clipboard unavailable: the address is shown on screen */
    }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  return (
    <AuthLayout
      title={t('Your account is inactive', 'حسابك غير نشط حاليا')}
      subtitle={t(
        'Access to this portal has been temporarily disabled. This usually happens when an account is suspended or archived. Your historical data is safe.',
        'تم تعطيل الوصول إلى هذه البوابة مؤقتا. يحدث هذا عادة عند إيقاف الحساب أو أرشفته. بياناتك السابقة محفوظة بأمان.',
      )}
      toolbar={
        <>
          <Button variant="ghost" onClick={toggleLanguage} className="gap-1.5">
            <Globe aria-hidden />
            {isArabic ? 'English' : 'العربية'}
          </Button>
          <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label={t('Toggle theme', 'تبديل المظهر')}>
            {theme === 'dark' ? <Sun aria-hidden /> : <Moon aria-hidden />}
          </Button>
        </>
      }
      heroTitle={t('We are here to help.', 'نحن هنا للمساعدة.')}
      heroText={t('Contact support and we will restore your access.', 'تواصل مع الدعم وسنعيد لك الوصول.')}
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-xl border border-tone-warning-border bg-tone-warning-bg p-3 text-sm text-tone-warning-fg">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{t('Please contact support to restore access.', 'يرجى التواصل مع الدعم لاستعادة الوصول.')}</span>
        </div>
        <Button size="lg" className="w-full" onClick={() => void copy()}>
          {copied ? <Check aria-hidden /> : <Mail aria-hidden />}
          {copied ? t('Copied', 'تم النسخ') : t('Contact support', 'تواصل مع الدعم')}
        </Button>
        <p className="text-center text-sm text-muted-foreground" dir="ltr">
          {SUPPORT_EMAIL}
        </p>
        <Button asChild variant="ghost" className="w-full">
          <Link to="/login">{t('Back to login', 'العودة لتسجيل الدخول')}</Link>
        </Button>
      </div>
    </AuthLayout>
  )
}
