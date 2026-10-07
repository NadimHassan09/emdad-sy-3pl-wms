import { Link, useNavigate } from 'react-router'
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowUpFromLine,
  Boxes,
  Home,
  ShoppingCart,
  Warehouse,
} from 'lucide-react'
import { useUiPreferences } from '@emdad/core'
import { cn } from '@emdad/ui'
import { Button } from '@emdad/ui/ui/button'

const HERO_SRC = '/illustrations/404-hero.jpg'

const QUICK_LINKS = [
  { to: '/orders/inbound', icon: ArrowDownToLine, en: 'Inbound', ar: 'الوارد' },
  { to: '/orders/outbound', icon: ArrowUpFromLine, en: 'Outbound', ar: 'الصادر' },
  { to: '/inventory/stock', icon: Boxes, en: 'Inventory', ar: 'المخزون' },
  { to: '/orders/oms', icon: ShoppingCart, en: 'Orders', ar: 'الطلبات' },
  { to: '/warehouses', icon: Warehouse, en: 'Warehouses', ar: 'المستودعات' },
] as const

/** Authenticated catch-all — unknown routes land here (guests are sent to /login by RequireAuth). */
export function NotFoundPage() {
  const { isArabic } = useUiPreferences()
  const navigate = useNavigate()
  const t = (en: string, ar: string) => (isArabic ? ar : en)

  return (
    <div className="flex min-h-[calc(100svh-8rem)] items-center justify-center">
      <div className="w-full max-w-3xl rounded-2xl border bg-card px-5 py-8 text-center sm:px-10 sm:py-10">
        <img
          src={HERO_SRC}
          alt=""
          width={1024}
          height={341}
          className="mx-auto h-auto w-full max-w-2xl select-none"
          draggable={false}
        />

        <h1 className="mt-6 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {t('Page not found', 'الصفحة غير موجودة')}
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground sm:text-base">
          {t(
            "The page you're looking for doesn't exist or has been moved.",
            'الصفحة التي تبحث عنها غير موجودة أو تم نقلها.',
          )}
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button asChild className="min-h-10 gap-2">
            <Link to="/dashboard/overview">
              <Home className="size-4" aria-hidden />
              {t('Go to Dashboard', 'الذهاب للوحة التحكم')}
            </Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-10 gap-2"
            onClick={() => {
              if (window.history.length > 1) navigate(-1)
              else navigate('/dashboard/overview')
            }}
          >
            <ArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden />
            {t('Go Back', 'رجوع')}
          </Button>
        </div>

        <div className="mt-10 border-t pt-8">
          <h2 className="text-sm font-semibold text-foreground">
            {t('Need help finding something?', 'محتاج مساعدة توصل لصفحة؟')}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t(
              'You can use the search bar or go to one of the main sections.',
              'تقدر تستخدم شريط البحث أو تروح لأحد الأقسام الرئيسية.',
            )}
          </p>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            {QUICK_LINKS.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  'inline-flex min-h-10 items-center gap-2 rounded-lg border bg-muted/40 px-3.5 text-sm font-medium text-foreground',
                  'transition-colors hover:bg-muted hover:text-foreground',
                )}
              >
                <item.icon className="size-4 text-muted-foreground" aria-hidden />
                {isArabic ? item.ar : item.en}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
