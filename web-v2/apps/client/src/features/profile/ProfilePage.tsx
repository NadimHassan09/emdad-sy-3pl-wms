import { useEffect, useState, type FormEvent } from 'react'
import { ArrowUpRight, Bell, MessageCircle, Receipt, User } from 'lucide-react'
import { useUiPreferences } from '@emdad/core'
import { Link, PageHeader } from '@emdad/ui'
import { Button } from '@emdad/ui/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@emdad/ui/ui/card'
import { Input } from '@emdad/ui/ui/input'
import { Label } from '@emdad/ui/ui/label'
import { useAuth } from '@/auth/AuthContext'
import { ImageUploadField } from '@/components/ImageUploadField'
import { clientMediaSrc } from '@/lib/client-media'
import { isClientAdmin } from '@/lib/rbac'
import {
  changeClientPassword,
  deleteClientAvatar,
  updateClientProfile,
  uploadClientAvatar,
} from '@/services/authService'

const SUPPORT_WHATSAPP_E164 = '963983628071'
const SUPPORT_WHATSAPP_DISPLAY = '+963 983 628 071'

function roleLabel(role: string, isArabic: boolean): string {
  if (role === 'client_staff') return isArabic ? 'موظف عميل' : 'Client staff'
  if (role === 'client_admin') return isArabic ? 'مدير عميل' : 'Client administrator'
  return role
}

export function ProfilePage() {
  const { user, refreshUser } = useAuth()
  const { isArabic } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)

  const [uploading, setUploading] = useState(false)
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const [avatarVersion, setAvatarVersion] = useState(() => Date.now())
  const avatarSrc = clientMediaSrc(user?.avatarUrl, avatarVersion)

  const [fullName, setFullName] = useState(user?.fullName?.trim() || '')
  const [profileBusy, setProfileBusy] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordBusy, setPasswordBusy] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null)

  useEffect(() => {
    setFullName(user?.fullName?.trim() || '')
  }, [user?.fullName])

  async function submitProfile(e: FormEvent): Promise<void> {
    e.preventDefault()
    const nextName = fullName.trim()
    if (!nextName) {
      setProfileError(t('Full name is required.', 'الاسم الكامل مطلوب.'))
      setProfileSuccess(null)
      return
    }
    if (nextName === (user?.fullName?.trim() || '')) {
      setProfileError(null)
      return
    }
    setProfileBusy(true)
    setProfileError(null)
    setProfileSuccess(null)
    try {
      await updateClientProfile({ fullName: nextName })
      await refreshUser()
      setProfileSuccess(t('Profile updated.', 'تم تحديث الملف الشخصي.'))
    } catch (err) {
      setProfileError(
        err instanceof Error ? err.message : t('Could not update profile.', 'تعذر تحديث الملف الشخصي.'),
      )
    } finally {
      setProfileBusy(false)
    }
  }

  async function submitPassword(e: FormEvent): Promise<void> {
    e.preventDefault()
    setPasswordError(null)
    setPasswordSuccess(null)
    if (newPassword.length < 8) {
      setPasswordError(
        t('New password must be at least 8 characters.', 'كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل.'),
      )
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(t('New passwords do not match.', 'كلمتا المرور الجديدتان غير متطابقتين.'))
      return
    }
    setPasswordBusy(true)
    try {
      await changeClientPassword({ currentPassword, newPassword })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordSuccess(t('Password changed successfully.', 'تم تغيير كلمة المرور بنجاح.'))
    } catch (err) {
      setPasswordError(
        err instanceof Error ? err.message : t('Could not change password.', 'تعذر تغيير كلمة المرور.'),
      )
    } finally {
      setPasswordBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader
        title={t('Profile', 'الملف الشخصي')}
        description={t('Your account and preferences', 'حسابك وتفضيلاتك')}
      />

      <Card className="overflow-hidden">
        <div className="relative h-24 bg-sidebar">
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage:
                'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.15) 1px, transparent 0)',
              backgroundSize: '20px 20px',
            }}
          />
        </div>
        <CardContent className="space-y-4 px-5 pb-5">
          <div className="relative -mt-10 rounded-2xl border bg-card p-3 shadow-sm">
            <ImageUploadField
              label={t('Profile photo', 'صورة الملف الشخصي')}
              hint={t('Images are compressed before saving.', 'يتم ضغط الصور قبل الحفظ.')}
              previewUrl={avatarSrc}
              uploading={uploading}
              isArabic={isArabic}
              onUpload={async (file) => {
                setAvatarError(null)
                setUploading(true)
                try {
                  await uploadClientAvatar(file)
                  await refreshUser()
                  setAvatarVersion(Date.now())
                } catch (err) {
                  setAvatarError(err instanceof Error ? err.message : 'Upload failed.')
                  throw err
                } finally {
                  setUploading(false)
                }
              }}
              onRemove={
                user?.avatarUrl
                  ? async () => {
                      setAvatarError(null)
                      setUploading(true)
                      try {
                        await deleteClientAvatar()
                        await refreshUser()
                        setAvatarVersion(Date.now())
                      } finally {
                        setUploading(false)
                      }
                    }
                  : undefined
              }
            />
            {avatarError ? (
              <p className="mt-1 text-xs text-destructive" role="alert">
                {avatarError}
              </p>
            ) : null}
          </div>

          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl border bg-muted/30 px-3 py-3">
              <dt className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                {t('Name', 'الاسم')}
              </dt>
              <dd className="mt-0.5 text-sm font-semibold">{user?.fullName || '—'}</dd>
            </div>
            <div className="rounded-xl border bg-muted/30 px-3 py-3">
              <dt className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                {t('Email', 'البريد الإلكتروني')}
              </dt>
              <dd className="mt-0.5 break-all text-sm font-semibold">{user?.email ?? '—'}</dd>
            </div>
            <div className="rounded-xl border bg-muted/30 px-3 py-3">
              <dt className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                {t('Role', 'الدور')}
              </dt>
              <dd className="mt-0.5 text-sm font-semibold">
                {user ? roleLabel(user.role, isArabic) : '—'}
              </dd>
            </div>
            <div className="rounded-xl border bg-muted/30 px-3 py-3">
              <dt className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                {t('Company', 'الشركة')}
              </dt>
              <dd className="mt-0.5 text-sm font-semibold">{user?.companyName || '—'}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('Personal details', 'البيانات الشخصية')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {t(
              'Update your display name. Email, role, and company are managed by your warehouse account manager.',
              'حدّث اسم العرض. البريد الإلكتروني والدور والشركة يُديرها مدير حساب المستودع.',
            )}
          </p>
          <form onSubmit={(e) => void submitProfile(e)} className="mt-4 space-y-3">
            <div className="space-y-2">
              <Label htmlFor="profile-fullName">{t('Full name', 'الاسم الكامل')}</Label>
              <Input
                id="profile-fullName"
                name="profile-fullName"
                required
                autoComplete="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
            {profileError ? (
              <p className="text-xs text-destructive" role="alert">
                {profileError}
              </p>
            ) : null}
            {profileSuccess ? (
              <p className="text-xs text-tone-success-fg" role="status">
                {profileSuccess}
              </p>
            ) : null}
            <Button type="submit" disabled={profileBusy}>
              {profileBusy ? t('Saving…', 'جاري الحفظ…') : t('Save changes', 'حفظ التغييرات')}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('Change password', 'تغيير كلمة المرور')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {t(
              'Enter your current password, then choose a new one (at least 8 characters).',
              'أدخل كلمة المرور الحالية، ثم اختر كلمة مرور جديدة (8 أحرف على الأقل).',
            )}
          </p>
          <form onSubmit={(e) => void submitPassword(e)} className="mt-4 space-y-3">
            <div className="space-y-2">
              <Label htmlFor="current-password">{t('Current password', 'كلمة المرور الحالية')}</Label>
              <Input
                id="current-password"
                type="password"
                name="current-password"
                required
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">{t('New password', 'كلمة المرور الجديدة')}</Label>
              <Input
                id="new-password"
                type="password"
                name="new-password"
                required
                minLength={8}
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">
                {t('Confirm new password', 'تأكيد كلمة المرور الجديدة')}
              </Label>
              <Input
                id="confirm-password"
                type="password"
                name="confirm-password"
                required
                minLength={8}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            {passwordError ? (
              <p className="text-xs text-destructive" role="alert">
                {passwordError}
              </p>
            ) : null}
            {passwordSuccess ? (
              <p className="text-xs text-tone-success-fg" role="status">
                {passwordSuccess}
              </p>
            ) : null}
            <Button type="submit" disabled={passwordBusy}>
              {passwordBusy
                ? t('Updating…', 'جاري التحديث…')
                : t('Update password', 'تحديث كلمة المرور')}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link
          to="/notifications"
          className="group rounded-xl border bg-card p-5 no-underline transition-colors hover:border-primary/40 hover:bg-brand-50"
        >
          <div className="flex items-start justify-between">
            <span className="grid size-10 place-items-center rounded-lg bg-tone-progress-bg text-tone-progress-fg">
              <Bell className="size-5" aria-hidden />
            </span>
            <ArrowUpRight className="size-4 text-muted-foreground transition group-hover:text-foreground rtl:-scale-x-100" />
          </div>
          <h3 className="mt-3 text-sm font-semibold text-foreground">{t('Notifications', 'الإشعارات')}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('View and manage your notification preferences.', 'عرض وإدارة تفضيلات الإشعارات الخاصة بك.')}
          </p>
        </Link>
        {isClientAdmin(user?.role) ? (
          <Link
            to="/billing"
            className="group rounded-xl border bg-card p-5 no-underline transition-colors hover:border-primary/40 hover:bg-brand-50"
          >
            <div className="flex items-start justify-between">
              <span className="grid size-10 place-items-center rounded-lg bg-brand-100 text-brand-800">
                <Receipt className="size-5" aria-hidden />
              </span>
              <ArrowUpRight className="size-4 text-muted-foreground transition group-hover:text-foreground rtl:-scale-x-100" />
            </div>
            <h3 className="mt-3 text-sm font-semibold text-foreground">{t('Billing', 'الفوترة')}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('Review invoices, payments, and subscription.', 'مراجعة الفواتير والمدفوعات والاشتراك.')}
            </p>
          </Link>
        ) : (
          <div className="rounded-xl border bg-card p-5">
            <div className="flex items-start justify-between">
              <span className="grid size-10 place-items-center rounded-lg bg-muted text-muted-foreground">
                <User className="size-5" aria-hidden />
              </span>
            </div>
            <h3 className="mt-3 text-sm font-semibold text-foreground">{t('Account', 'الحساب')}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('Ask an admin for billing access.', 'اطلب من المسؤول صلاحية الفوترة.')}
            </p>
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('Need help?', 'تحتاج مساعدة؟')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {t(
              'Contact your warehouse account manager for access changes or billing questions.',
              'تواصل مع مدير حساب المستودع لتغييرات الوصول أو أسئلة الفوترة.',
            )}
          </p>
          <a
            href={`https://wa.me/${SUPPORT_WHATSAPP_E164}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#DCF8C6] px-3 py-1.5 text-sm font-medium text-[#075E54] no-underline transition-colors hover:bg-[#c8f0b0]"
          >
            <MessageCircle className="size-4" aria-hidden />
            {t('WhatsApp', 'واتساب')}
            <span className="text-xs font-normal opacity-80" dir="ltr">
              {SUPPORT_WHATSAPP_DISPLAY}
            </span>
          </a>
        </CardContent>
      </Card>
    </div>
  )
}
