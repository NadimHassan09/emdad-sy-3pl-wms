import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type FormEvent, useState } from 'react'
import { Navigate } from 'react-router'
import { formatDateTime, useUiPreferences } from '@emdad/core'
import { ConfirmDialog, PageHeader } from '@emdad/ui'
import { Alert, AlertDescription } from '@emdad/ui/ui/alert'
import { Button } from '@emdad/ui/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@emdad/ui/ui/card'
import { Input } from '@emdad/ui/ui/input'
import { Label } from '@emdad/ui/ui/label'
import { StatusBadge } from '@emdad/ui'
import { toast } from 'sonner'
import { ShippingApi, type ShippingProviderAdminView } from '@/api/shipping'
import { useAuth } from '@/auth/AuthContext'
import { QK } from '@/constants/query-keys'
import { defaultHomePath } from '@/lib/rbac'

function canAccessShippingAdmin(role: string | undefined): boolean {
  return role === 'super_admin' || role === 'wh_manager'
}

function ProviderCard({
  provider,
  canMutate,
}: {
  provider: ShippingProviderAdminView
  canMutate: boolean
}) {
  const { isArabic, locale } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const queryClient = useQueryClient()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [disconnectOpen, setDisconnectOpen] = useState(false)

  const connectMutation = useMutation({
    mutationFn: () =>
      ShippingApi.connectProvider(provider.code, {
        username,
        password: provider.code === 'SILA_SY' ? 'N/A' : password,
      }),
    onSuccess: () => {
      setUsername('')
      setPassword('')
      toast.success(t(`${provider.name} connected.`, `تم ربط ${provider.name}.`))
      void queryClient.invalidateQueries({ queryKey: QK.shipping.providers })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const testMutation = useMutation({
    mutationFn: () => ShippingApi.testProvider(provider.code),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.message ?? t('Connection test failed.', 'فشل اختبار الاتصال.'))
        void queryClient.invalidateQueries({ queryKey: QK.shipping.providers })
        return
      }
      toast.success(result.message?.trim() || t('Connection OK', 'الاتصال سليم'))
      void queryClient.invalidateQueries({ queryKey: QK.shipping.providers })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const disconnectMutation = useMutation({
    mutationFn: () => ShippingApi.disconnectProvider(provider.code),
    onSuccess: () => {
      setDisconnectOpen(false)
      toast.success(t(`${provider.name} disconnected.`, `تم فصل ${provider.name}.`))
      void queryClient.invalidateQueries({ queryKey: QK.shipping.providers })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const isSila = provider.code === 'SILA_SY'

  const onConnect = (e: FormEvent) => {
    e.preventDefault()
    if (!username.trim() || (!isSila && !password)) {
      toast.error(
        isSila
          ? t('API Key is required.', 'مفتاح API مطلوب.')
          : t('Username and password are required.', 'اسم المستخدم وكلمة المرور مطلوبان.'),
      )
      return
    }
    if (isSila && !username.trim().startsWith('sila_live_')) {
      toast.error(
        t(
          'Sila API key must start with "sila_live_".',
          'يجب أن يبدأ مفتاح Sila API بـ "sila_live_".',
        ),
      )
      return
    }
    connectMutation.mutate()
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
        <div>
          <CardTitle className="text-base">{provider.name}</CardTitle>
          <CardDescription>
            {t('Provider code', 'رمز المزود')}: {provider.code}
          </CardDescription>
        </div>
        {canMutate && provider.connected ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" disabled={testMutation.isPending} onClick={() => testMutation.mutate()}>
              {t('Test connection', 'اختبار الاتصال')}
            </Button>
            <Button variant="destructive" onClick={() => setDisconnectOpen(true)}>
              {t('Disconnect', 'فصل')}
            </Button>
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div
            className={`rounded-xl border-2 p-4 ${provider.connected ? 'border-emerald-200 bg-emerald-50' : 'border-border bg-muted/30'}`}
          >
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t('Connection status', 'حالة الاتصال')}
            </p>
            <div className="mt-2">
              <StatusBadge tone={provider.connected ? 'success' : 'neutral'}>
                {provider.connected ? t('Connected', 'متصل') : t('Not connected', 'غير متصل')}
              </StatusBadge>
            </div>
            {provider.connectedBy ? (
              <p className="mt-2 text-xs text-muted-foreground">
                {provider.connectedBy.fullName || provider.connectedBy.email}
              </p>
            ) : null}
          </div>

          <div className="rounded-xl border p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {isSila ? t('API Key', 'مفتاح API') : t('Username', 'اسم المستخدم')}
            </p>
            <p className="mt-1 font-mono text-sm font-semibold">
              {provider.connected
                ? (provider.usernameMasked ?? '********')
                : t('Not saved', 'غير محفوظ')}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {isSila
                ? t('API key is stored encrypted.', 'يتم تخزين مفتاح API مشفراً.')
                : t('Password is never shown after save.', 'لا تُعرض كلمة المرور بعد الحفظ.')}
            </p>
          </div>

          <div className="rounded-xl border p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t('Last test', 'آخر اختبار')}
            </p>
            <p className="mt-1 text-sm font-semibold">{provider.lastTestStatus ?? '—'}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {provider.lastTestedAt ? formatDateTime(provider.lastTestedAt, locale) : '—'}
            </p>
            {provider.lastErrorSafe ? (
              <p className="mt-2 text-xs text-destructive">{provider.lastErrorSafe}</p>
            ) : null}
          </div>
        </div>

        {canMutate && !provider.connected ? (
          <form onSubmit={onConnect} className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label>{isSila ? t('API Key', 'مفتاح API') : t('Username', 'اسم المستخدم')}</Label>
              <Input
                value={username}
                autoComplete="off"
                placeholder={isSila ? 'sila_live_...' : ''}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            {!isSila ? (
              <div className="space-y-2">
                <Label>{t('Password', 'كلمة المرور')}</Label>
                <Input
                  type="password"
                  value={password}
                  autoComplete="new-password"
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            ) : null}
            <div className="md:col-span-2">
              <Button type="submit" disabled={connectMutation.isPending}>
                {t('Connect', 'ربط')}
              </Button>
            </div>
          </form>
        ) : null}

        {canMutate ? (
          <ConfirmDialog
            open={disconnectOpen}
            title={t('Disconnect shipping company?', 'فصل شركة الشحن؟')}
            description={t(
              'Encrypted credentials will be removed. Existing shipments are not deleted.',
              'ستُزال بيانات الاعتماد المشفّرة. لن تُحذف الشحنات الحالية.',
            )}
            confirmLabel={t('Disconnect', 'فصل')}
            cancelLabel={t('Cancel', 'إلغاء')}
            intent="danger"
            loading={disconnectMutation.isPending}
            onConfirm={() => disconnectMutation.mutate()}
            onOpenChange={(v) => !v && setDisconnectOpen(false)}
          />
        ) : null}
      </CardContent>
    </Card>
  )
}

export function ShippingCompaniesPage() {
  const { user } = useAuth()
  const { isArabic } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const canAccess = canAccessShippingAdmin(user?.role)

  const providersQuery = useQuery({
    queryKey: QK.shipping.providers,
    queryFn: () => ShippingApi.listProviders(),
    enabled: canAccess,
  })

  if (!canAccess) {
    return <Navigate to={defaultHomePath(user?.role)} replace />
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('Shipping Companies', 'شركات الشحن')}
        description={t(
          'Connect carrier accounts (e.g. Babel Express). Credentials are stored encrypted; passwords are never shown after save.',
          'اربط حسابات شركات الشحن (مثل Babel Express). تُخزَّن بيانات الاعتماد مشفّرة؛ لا تُعرض كلمات المرور بعد الحفظ.',
        )}
      />

      {providersQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">{t('Loading…', 'جارٍ التحميل…')}</p>
      ) : providersQuery.isError ? (
        <Alert variant="destructive">
          <AlertDescription>{providersQuery.error.message}</AlertDescription>
        </Alert>
      ) : (providersQuery.data?.length ?? 0) === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t('No shipping providers configured.', 'لا توجد شركات شحن مُعدّة.')}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          {t(
            `${providersQuery.data!.length} provider(s) available.`,
            `${providersQuery.data!.length} مزود/مزودين متاحين.`,
          )}
        </p>
      )}

      {(providersQuery.data ?? []).map((provider) => (
        <ProviderCard key={provider.code} provider={provider} canMutate={canAccess} />
      ))}
    </div>
  )
}
