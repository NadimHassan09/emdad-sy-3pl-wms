import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Bell, CloudUpload } from 'lucide-react'
import { Link } from 'react-router'
import { useUiPreferences } from '@emdad/core'
import { PageHeader } from '@emdad/ui'
import { Alert, AlertDescription } from '@emdad/ui/ui/alert'
import { Button } from '@emdad/ui/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@emdad/ui/ui/card'
import { Input } from '@emdad/ui/ui/input'
import { Label } from '@emdad/ui/ui/label'
import { toast } from 'sonner'
import { AuthApi } from '@/api/auth'
import { useAuth } from '@/auth/AuthContext'
import {
  getRememberedAccount,
  isPersistSessionEnabled,
  setAccessToken,
  setRememberedAccount,
} from '@/auth/authStorage'
import { adminMediaSrc } from '@/lib/admin-media'
import { canAccessPath } from '@/lib/rbac'

function roleLabel(role: string, isArabic: boolean): string {
  const map: Record<string, [string, string]> = {
    super_admin: ['Super admin', 'مدير النظام'],
    wh_manager: ['Admin', 'مدير'],
    wh_operator: ['Worker', 'عامل'],
    finance: ['Finance', 'مالية'],
  }
  const row = map[role]
  if (!row) return role
  return isArabic ? row[1] : row[0]
}

export function ProfilePage() {
  const { user, refresh } = useAuth()
  const { isArabic } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const showBackups = canAccessPath(user?.role, '/backups')

  const [uploading, setUploading] = useState(false)
  const [avatarVersion, setAvatarVersion] = useState(() => Date.now())
  const fileRef = useRef<HTMLInputElement>(null)

  const [fullName, setFullName] = useState(user?.fullName?.trim() || '')
  const [profileBusy, setProfileBusy] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordBusy, setPasswordBusy] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  useEffect(() => {
    setFullName(user?.fullName?.trim() || '')
  }, [user?.fullName])

  async function syncRememberedAvatar(nextUrl: string | null): Promise<void> {
    if (!isPersistSessionEnabled()) return
    const remembered = getRememberedAccount()
    if (!remembered) return
    setRememberedAccount({
      ...remembered,
      avatarUrl: nextUrl ? adminMediaSrc(nextUrl) : null,
    })
  }

  const avatarSrc = adminMediaSrc(user?.avatarUrl, avatarVersion)

  async function submitProfile(e: FormEvent): Promise<void> {
    e.preventDefault()
    const nextName = fullName.trim()
    if (!nextName) {
      setProfileError(t('Full name is required.', 'الاسم مطلوب.'))
      return
    }
    setProfileBusy(true)
    setProfileError(null)
    try {
      await AuthApi.updateProfile({ fullName: nextName })
      await refresh()
      toast.success(t('Profile updated.', 'تم التحديث.'))
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : t('Update failed.', 'فشل التحديث.'))
    } finally {
      setProfileBusy(false)
    }
  }

  async function submitPassword(e: FormEvent): Promise<void> {
    e.preventDefault()
    setPasswordError(null)
    if (newPassword.length < 8) {
      setPasswordError(t('New password must be at least 8 characters.', '8 أحرف على الأقل.'))
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(t('Passwords do not match.', 'كلمتا المرور غير متطابقتين.'))
      return
    }
    setPasswordBusy(true)
    try {
      const persist = isPersistSessionEnabled()
      const res = await AuthApi.changePassword({
        currentPassword,
        newPassword,
        rememberMe: persist,
      })
      setAccessToken(res.access_token, persist)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      await refresh()
      toast.success(t('Password changed.', 'تم تغيير كلمة المرور.'))
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : t('Change failed.', 'فشل التغيير.'))
    } finally {
      setPasswordBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader title={t('Profile', 'الملف الشخصي')} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('Account', 'الحساب')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            {avatarSrc ? (
              <img src={avatarSrc} alt="" className="size-20 rounded-2xl border object-cover" />
            ) : (
              <div className="flex size-20 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                —
              </div>
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
                {t('Upload photo', 'رفع صورة')}
              </Button>
              {user?.avatarUrl ? (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={uploading}
                  onClick={async () => {
                    setUploading(true)
                    try {
                      await AuthApi.deleteAvatar()
                      await refresh()
                      setAvatarVersion(Date.now())
                      await syncRememberedAvatar(null)
                    } finally {
                      setUploading(false)
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
                setUploading(true)
                try {
                  const res = await AuthApi.uploadAvatar(file)
                  await refresh()
                  setAvatarVersion(Date.now())
                  await syncRememberedAvatar(res.avatarUrl)
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : t('Upload failed.', 'فشل الرفع.'))
                } finally {
                  setUploading(false)
                }
              }}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Meta label={t('Email', 'البريد')} value={user?.email ?? '—'} />
            <Meta label={t('Role', 'الدور')} value={user ? roleLabel(user.role, isArabic) : '—'} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('Personal details', 'البيانات الشخصية')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void submitProfile(e)} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="profile-name">{t('Full name', 'الاسم الكامل')}</Label>
              <Input id="profile-name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </div>
            {profileError ? <Alert variant="destructive"><AlertDescription>{profileError}</AlertDescription></Alert> : null}
            <Button type="submit" disabled={profileBusy}>{t('Save changes', 'حفظ')}</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('Change password', 'تغيير كلمة المرور')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void submitPassword(e)} className="space-y-3">
            <div className="space-y-1.5">
              <Label>{t('Current password', 'الحالية')}</Label>
              <Input type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>{t('New password', 'الجديدة')}</Label>
              <Input type="password" autoComplete="new-password" minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>{t('Confirm password', 'تأكيد')}</Label>
              <Input type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
            </div>
            {passwordError ? <Alert variant="destructive"><AlertDescription>{passwordError}</AlertDescription></Alert> : null}
            <Button type="submit" disabled={passwordBusy}>{t('Update password', 'تحديث')}</Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="transition-colors hover:bg-muted/30">
          <Link to="/notifications" className="flex h-full flex-col p-4">
            <Bell className="size-5 text-muted-foreground" aria-hidden />
            <p className="mt-2 text-sm font-semibold">{t('Notifications', 'الإشعارات')}</p>
            <p className="text-xs text-muted-foreground">{t('View all alerts', 'عرض التنبيهات')}</p>
          </Link>
        </Card>
        {showBackups ? (
          <Card className="transition-colors hover:bg-muted/30">
            <Link to="/backups" className="flex h-full flex-col p-4">
              <CloudUpload className="size-5 text-muted-foreground" aria-hidden />
              <p className="mt-2 text-sm font-semibold">{t('Backups', 'النسخ الاحتياطي')}</p>
              <p className="text-xs text-muted-foreground">{t('Recovery tools', 'أدوات الاستعادة')}</p>
            </Link>
          </Card>
        ) : null}
      </div>
    </div>
  )
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm font-semibold break-all">{value}</div>
    </div>
  )
}
