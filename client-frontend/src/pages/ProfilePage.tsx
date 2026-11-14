import { useEffect, useState, type FormEvent, type ReactElement } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button, TextField } from '@ds';

import { Card } from '../design-v2/Card';
import { ImageUploadField } from '../components/ImageUploadField';
import { useAuth } from '../auth/AuthContext';
import { clientMediaSrc } from '../lib/client-media';
import { isClientArabic } from '../lib/client-ui-language';
import { isGoogleAuthUiEnabled } from '../lib/google-auth-ui';
import { isClientAdmin } from '../lib/rbac';
import { getClientApiBaseUrl } from '../services/apiBaseUrl';
import {
  changeClientPassword,
  deleteClientAvatar,
  unlinkGoogleAccount,
  updateClientProfile,
  uploadClientAvatar,
} from '../services/authService';

const GOOGLE_ERROR_MESSAGES: Record<string, string> = {
  google_denied: 'Google sign-in was cancelled.',
  google_invalid: 'Google sign-in failed. Please try again.',
  google_conflict: 'That Google account is already linked to another user.',
  google_forbidden: 'Your account does not have portal access.',
  google_inactive: 'Your account is inactive.',
};

function roleLabel(role: string, isArabic: boolean): string {
  if (role === 'client_staff') return isArabic ? 'موظف عميل' : 'Client staff';
  if (role === 'client_admin') return isArabic ? 'مدير عميل' : 'Client administrator';
  return role;
}

function t(label: string, isArabic: boolean): string {
  if (!isArabic) return label;
  const ar: Record<string, string> = {
    Profile: 'الملف الشخصي',
    'Your account and preferences': 'حسابك وتفضيلاتك',
    'Profile photo': 'صورة الملف الشخصي',
    'Images are compressed before saving.': 'يتم ضغط الصور قبل الحفظ.',
    Name: 'الاسم',
    Email: 'البريد الإلكتروني',
    Role: 'الدور',
    Company: 'الشركة',
    'Personal details': 'البيانات الشخصية',
    'Update your display name. Email, role, and company are managed by your warehouse account manager.':
      'حدّث اسم العرض. البريد الإلكتروني والدور والشركة يُديرها مدير حساب المستودع.',
    'Full name': 'الاسم الكامل',
    'Full name is required.': 'الاسم الكامل مطلوب.',
    'Save changes': 'حفظ التغييرات',
    'Profile updated.': 'تم تحديث الملف الشخصي.',
    'Could not update profile.': 'تعذر تحديث الملف الشخصي.',
    'Change password': 'تغيير كلمة المرور',
    'Enter your current password, then choose a new one (at least 8 characters).':
      'أدخل كلمة المرور الحالية، ثم اختر كلمة مرور جديدة (8 أحرف على الأقل).',
    'Current password': 'كلمة المرور الحالية',
    'New password': 'كلمة المرور الجديدة',
    'Confirm new password': 'تأكيد كلمة المرور الجديدة',
    'New password must be at least 8 characters.':
      'كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل.',
    'New passwords do not match.': 'كلمتا المرور الجديدتان غير متطابقتين.',
    'Update password': 'تحديث كلمة المرور',
    'Password changed successfully.': 'تم تغيير كلمة المرور بنجاح.',
    'Could not change password.': 'تعذر تغيير كلمة المرور.',
    Notifications: 'الإشعارات',
    'View and manage your notification preferences.': 'عرض وإدارة تفضيلات الإشعارات الخاصة بك.',
    Billing: 'الفوترة',
    'Review invoices, payments, and subscription.': 'مراجعة الفواتير والمدفوعات والاشتراك.',
    'Need help?': 'تحتاج مساعدة؟',
    'Contact your warehouse account manager for access changes or billing questions.':
      'تواصل مع مدير حساب المستودع لتغييرات الوصول أو أسئلة الفوترة.',
    WhatsApp: 'واتساب',
    'Google account': 'حساب Google',
    'Link your Google account to sign in without a password.':
      'اربط حساب Google الخاص بك لتسجيل الدخول بدون كلمة مرور.',
    'Link Google account': 'ربط حساب Google',
    'Unlink Google account': 'إلغاء ربط حساب Google',
    'Google account linked': 'تم ربط حساب Google',
    'Google account not available': 'حساب Google غير متاح',
    'Google Sign-In is not configured for this portal.':
      'لم يتم تكوين تسجيل الدخول عبر Google لهذه البوابة.',
    'Google account unlinked successfully.': 'تم إلغاء ربط حساب Google بنجاح.',
    'Could not unlink Google account.': 'تعذر إلغاء ربط حساب Google.',
  };
  return ar[label] ?? label;
}

const SUPPORT_WHATSAPP_E164 = '963983628071';
const SUPPORT_WHATSAPP_DISPLAY = '+963 983 628 071';

export function ProfilePage(): ReactElement {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isArabic = isClientArabic();
  const label = (s: string) => t(s, isArabic);
  const [uploading, setUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [avatarVersion, setAvatarVersion] = useState(() => Date.now());
  const avatarSrc = clientMediaSrc(user?.avatarUrl, avatarVersion);

  const [fullName, setFullName] = useState(user?.fullName?.trim() || '');
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  const [googleEnabled, setGoogleEnabled] = useState<boolean | null>(null);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [googleMessage, setGoogleMessage] = useState<string | null>(null);
  const [googleError, setGoogleError] = useState<string | null>(null);

  useEffect(() => {
    setFullName(user?.fullName?.trim() || '');
  }, [user?.fullName]);

  useEffect(() => {
    if (!isGoogleAuthUiEnabled()) {
      setGoogleEnabled(false);
      return;
    }
    void (async () => {
      try {
        const res = await fetch(`${getClientApiBaseUrl()}/auth/google/status`, { credentials: 'include' });
        if (res.ok) {
          const json = (await res.json()) as { enabled: boolean };
          setGoogleEnabled(json.enabled);
        }
      } catch {
        setGoogleEnabled(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!isGoogleAuthUiEnabled()) return;
    const linked = searchParams.get('google_linked');
    const err = searchParams.get('google_error');
    if (linked === '1') {
      void refreshUser();
      setGoogleMessage(label('Google account linked'));
      setSearchParams({}, { replace: true });
    } else if (err) {
      setGoogleError(GOOGLE_ERROR_MESSAGES[err] ?? 'Google sign-in failed.');
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submitProfile(e: FormEvent): Promise<void> {
    e.preventDefault();
    const nextName = fullName.trim();
    if (!nextName) {
      setProfileError(label('Full name is required.'));
      setProfileSuccess(null);
      return;
    }
    if (nextName === (user?.fullName?.trim() || '')) {
      setProfileError(null);
      return;
    }
    setProfileBusy(true);
    setProfileError(null);
    setProfileSuccess(null);
    try {
      await updateClientProfile({ fullName: nextName });
      await refreshUser();
      setProfileSuccess(label('Profile updated.'));
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : label('Could not update profile.'));
    } finally {
      setProfileBusy(false);
    }
  }

  async function handleGoogleUnlink(): Promise<void> {
    setGoogleBusy(true);
    setGoogleError(null);
    setGoogleMessage(null);
    try {
      await unlinkGoogleAccount();
      await refreshUser();
      setGoogleMessage(label('Google account unlinked successfully.'));
    } catch (err) {
      setGoogleError(err instanceof Error ? err.message : label('Could not unlink Google account.'));
    } finally {
      setGoogleBusy(false);
    }
  }

  async function submitPassword(e: FormEvent): Promise<void> {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);
    if (newPassword.length < 8) {
      setPasswordError(label('New password must be at least 8 characters.'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(label('New passwords do not match.'));
      return;
    }
    setPasswordBusy(true);
    try {
      await changeClientPassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordSuccess(label('Password changed successfully.'));
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : label('Could not change password.'));
    } finally {
      setPasswordBusy(false);
    }
  }

  return (
    <div className="space-y-5 animate-enter max-w-3xl">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-white/5 flex items-center justify-center">
          <i className="fa-solid fa-user text-brand-600 dark:text-brand-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-text-strong">{label('Profile')}</h1>
          <p className="text-xs text-text-muted">{label('Your account and preferences')}</p>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="h-24 bg-dark-950 relative">
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage:
                'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.15) 1px, transparent 0)',
              backgroundSize: '20px 20px',
            }}
          />
        </div>
        <div className="px-6 pb-6">
          <div className="relative -mt-10 mb-4">
            <div className="bg-surface-panel rounded-2xl p-3 shadow-lg border border-border">
              <ImageUploadField
                label={label('Profile photo')}
                hint={label('Images are compressed before saving.')}
                previewUrl={avatarSrc}
                rounded="2xl"
                size="lg"
                uploading={uploading}
                isArabic={isArabic}
                onUpload={async (file) => {
                  setAvatarError(null);
                  setUploading(true);
                  try {
                    await uploadClientAvatar(file);
                    await refreshUser();
                    setAvatarVersion(Date.now());
                  } catch (err) {
                    setAvatarError(err instanceof Error ? err.message : 'Upload failed.');
                    throw err;
                  } finally {
                    setUploading(false);
                  }
                }}
                onRemove={
                  user?.avatarUrl
                    ? async () => {
                        setAvatarError(null);
                        setUploading(true);
                        try {
                          await deleteClientAvatar();
                          await refreshUser();
                          setAvatarVersion(Date.now());
                        } finally {
                          setUploading(false);
                        }
                      }
                    : undefined
                }
              />
              {avatarError ? <p className="mt-1 text-xs text-danger-600 dark:text-status-danger-fg">{avatarError}</p> : null}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-3 bg-surface-sunken rounded-lg border border-border-subtle">
              <div className="text-[11px] font-bold text-text-faint uppercase tracking-wide">
                {label('Name')}
              </div>
              <div className="text-sm font-semibold text-text-strong mt-0.5">{user?.fullName || '—'}</div>
            </div>
            <div className="p-3 bg-surface-sunken rounded-lg border border-border-subtle">
              <div className="text-[11px] font-bold text-text-faint uppercase tracking-wide">
                {label('Email')}
              </div>
              <div className="text-sm font-semibold text-text-strong mt-0.5 break-all">
                {user?.email ?? '—'}
              </div>
            </div>
            <div className="p-3 bg-surface-sunken rounded-lg border border-border-subtle">
              <div className="text-[11px] font-bold text-text-faint uppercase tracking-wide">
                {label('Role')}
              </div>
              <div className="text-sm font-semibold text-text-strong mt-0.5">
                {user ? roleLabel(user.role, isArabic) : '—'}
              </div>
            </div>
            <div className="p-3 bg-surface-sunken rounded-lg border border-border-subtle">
              <div className="text-[11px] font-bold text-text-faint uppercase tracking-wide">
                {label('Company')}
              </div>
              <div className="text-sm font-semibold text-text-strong mt-0.5">
                {user?.companyName || '—'}
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-text-strong">{label('Personal details')}</h2>
        <p className="mt-1 text-xs text-text-muted">
          {label(
            'Update your display name. Email, role, and company are managed by your warehouse account manager.',
          )}
        </p>
        <form onSubmit={(e) => void submitProfile(e)} className="mt-4 space-y-3">
          <TextField
            label={label('Full name')}
            name="profile-fullName"
            required
            autoComplete="name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
          {profileError ? <p className="text-xs text-status-danger-fg">{profileError}</p> : null}
          {profileSuccess ? <p className="text-xs text-status-success-fg">{profileSuccess}</p> : null}
          <Button type="submit" loading={profileBusy} disabled={profileBusy}>
            {label('Save changes')}
          </Button>
        </form>
      </Card>

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-text-strong">{label('Change password')}</h2>
        <p className="mt-1 text-xs text-text-muted">
          {label('Enter your current password, then choose a new one (at least 8 characters).')}
        </p>
        <form onSubmit={(e) => void submitPassword(e)} className="mt-4 space-y-3">
          <TextField
            label={label('Current password')}
            type="password"
            name="current-password"
            required
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
          <TextField
            label={label('New password')}
            type="password"
            name="new-password"
            required
            minLength={8}
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <TextField
            label={label('Confirm new password')}
            type="password"
            name="confirm-password"
            required
            minLength={8}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
          {passwordError ? <p className="text-xs text-status-danger-fg">{passwordError}</p> : null}
          {passwordSuccess ? (
            <p className="text-xs text-status-success-fg">{passwordSuccess}</p>
          ) : null}
          <Button type="submit" loading={passwordBusy} disabled={passwordBusy}>
            {label('Update password')}
          </Button>
        </form>
      </Card>

      {isGoogleAuthUiEnabled() && googleEnabled !== false ? (
        <Card className="p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-lg bg-surface-sunken border border-border flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-text-strong">{label('Google account')}</h2>
              <p className="text-xs text-text-muted">
                {label('Link your Google account to sign in without a password.')}
              </p>
            </div>
          </div>

          {googleEnabled === null ? (
            <p className="text-xs text-text-faint">{isArabic ? 'جارٍ التحقق...' : 'Checking…'}</p>
          ) : user?.googleLinked ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-status-success-fg">
                <i className="fa-solid fa-circle-check" />
                <span>{label('Google account linked')}{user.googleEmail ? ` (${user.googleEmail})` : ''}</span>
              </div>
              {googleMessage ? <p className="text-xs text-status-success-fg">{googleMessage}</p> : null}
              {googleError ? <p className="text-xs text-status-danger-fg">{googleError}</p> : null}
              <Button variant="secondary" loading={googleBusy} disabled={googleBusy} onClick={() => void handleGoogleUnlink()}>
                {label('Unlink Google account')}
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {googleMessage ? <p className="text-xs text-status-success-fg">{googleMessage}</p> : null}
              {googleError ? <p className="text-xs text-status-danger-fg">{googleError}</p> : null}
              <a
                href={`${getClientApiBaseUrl()}/auth/google/link`}
                className="inline-block"
              >
                <Button variant="secondary" disabled={googleBusy}>
                  <svg viewBox="0 0 24 24" className="w-4 h-4 mr-2 inline-block" aria-hidden="true">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  {label('Link Google account')}
                </Button>
              </a>
            </div>
          )}
        </Card>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card
          className="p-5 cursor-pointer"
          hover
          role="link"
          tabIndex={0}
          onClick={() => navigate('/notifications')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              navigate('/notifications');
            }
          }}
        >
          <div className="flex items-start justify-between">
            <div className="w-10 h-10 rounded-lg bg-status-info-bg flex items-center justify-center">
              <i className="fa-solid fa-bell text-status-info-fg" />
            </div>
            <i className="fa-solid fa-arrow-right rtl:rotate-180 text-text-faint text-xs" />
          </div>
          <h3 className="text-sm font-semibold text-text-strong mt-3">{label('Notifications')}</h3>
          <p className="text-xs text-text-muted mt-1">
            {label('View and manage your notification preferences.')}
          </p>
        </Card>
        {isClientAdmin(user?.role) ? (
          <Card
            className="p-5 cursor-pointer"
            hover
            role="link"
            tabIndex={0}
            onClick={() => navigate('/billing')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                navigate('/billing');
              }
            }}
          >
            <div className="flex items-start justify-between">
              <div className="w-10 h-10 rounded-lg bg-brand-50 dark:bg-white/5 flex items-center justify-center">
                <i className="fa-solid fa-file-invoice-dollar text-brand-600 dark:text-brand-400" />
              </div>
              <i className="fa-solid fa-arrow-right rtl:rotate-180 text-text-faint text-xs" />
            </div>
            <h3 className="text-sm font-semibold text-text-strong mt-3">{label('Billing')}</h3>
            <p className="text-xs text-text-muted mt-1">
              {label('Review invoices, payments, and subscription.')}
            </p>
          </Card>
        ) : null}
      </div>

      <Card className="p-5">
        <h3 className="text-sm font-semibold text-text-strong">{label('Need help?')}</h3>
        <p className="text-xs text-text-muted mt-1 leading-relaxed">
          {label('Contact your warehouse account manager for access changes or billing questions.')}
        </p>
        <a
          href={`https://wa.me/${SUPPORT_WHATSAPP_E164}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-[#075E54] bg-[#DCF8C6] rounded-lg hover:bg-[#c8f0b0] transition-colors no-underline"
        >
          <i className="fa-brands fa-whatsapp text-sm" aria-hidden="true" />
          {label('WhatsApp')}
          <span className="text-[10px] font-normal opacity-80" dir="ltr">
            {SUPPORT_WHATSAPP_DISPLAY}
          </span>
        </a>
      </Card>
    </div>
  );
}
