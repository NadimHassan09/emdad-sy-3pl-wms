import { useState, type ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';

import { Card } from '../design-v2/Card';
import { ImageUploadField } from '../components/ImageUploadField';
import { useAuth } from '../auth/AuthContext';
import { clientMediaSrc } from '../lib/client-media';
import { isClientArabic } from '../lib/client-ui-language';
import { isClientAdmin } from '../lib/rbac';
import { deleteClientAvatar, uploadClientAvatar } from '../services/authService';

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
    'Managed by warehouse': 'يُدار بواسطة المستودع',
    'Profile details are managed by your warehouse account manager.':
      'تفاصيل الملف الشخصي يُديرها مدير حساب المستودع الخاص بك.',
    'Profile photo': 'صورة الملف الشخصي',
    'Images are compressed before saving.': 'يتم ضغط الصور قبل الحفظ.',
    Name: 'الاسم',
    Email: 'البريد الإلكتروني',
    Role: 'الدور',
    Company: 'الشركة',
    Notifications: 'الإشعارات',
    'View and manage your notification preferences.': 'عرض وإدارة تفضيلات الإشعارات الخاصة بك.',
    Billing: 'الفوترة',
    'Review invoices, payments, and subscription.': 'مراجعة الفواتير والمدفوعات والاشتراك.',
    'Need help?': 'تحتاج مساعدة؟',
    'Contact your warehouse account manager for access changes or billing questions.':
      'تواصل مع مدير حساب المستودع لتغييرات الوصول أو أسئلة الفوترة.',
    'Contact support': 'تواصل مع الدعم',
  };
  return ar[label] ?? label;
}

const SUPPORT_EMAIL = 'support@emdadsy.com';

export function ProfilePage(): ReactElement {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const isArabic = isClientArabic();
  const label = (s: string) => t(s, isArabic);
  const [uploading, setUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [avatarVersion, setAvatarVersion] = useState(() => Date.now());
  const avatarSrc = clientMediaSrc(user?.avatarUrl, avatarVersion);

  return (
    <div className="space-y-5 animate-enter max-w-3xl">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
          <i className="fa-solid fa-user text-emerald-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">{label('Profile')}</h1>
          <p className="text-xs text-slate-500">{label('Your account and preferences')}</p>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="h-24 bg-slate-900 relative">
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
          <div className="relative -mt-10 mb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="bg-white rounded-2xl p-3 shadow-lg border border-slate-100">
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
              {avatarError ? <p className="mt-1 text-xs text-rose-600">{avatarError}</p> : null}
            </div>
            <span
              className="mb-1 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-500 border border-slate-200 rounded-lg bg-slate-50 self-start sm:self-auto"
              title={label('Profile details are managed by your warehouse account manager.')}
            >
              <i className="fa-solid fa-lock text-[10px]" aria-hidden="true" />
              {label('Managed by warehouse')}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">
                {label('Name')}
              </div>
              <div className="text-sm font-semibold text-slate-900 mt-0.5">{user?.fullName || '—'}</div>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">
                {label('Email')}
              </div>
              <div className="text-sm font-semibold text-slate-900 mt-0.5 break-all">
                {user?.email ?? '—'}
              </div>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">
                {label('Role')}
              </div>
              <div className="text-sm font-semibold text-slate-900 mt-0.5">
                {user ? roleLabel(user.role, isArabic) : '—'}
              </div>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">
                {label('Company')}
              </div>
              <div className="text-sm font-semibold text-slate-900 mt-0.5">
                {user?.companyName || '—'}
              </div>
            </div>
          </div>
        </div>
      </Card>

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
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <i className="fa-solid fa-bell text-blue-600" />
            </div>
            <i className="fa-solid fa-arrow-right text-slate-300 text-xs" />
          </div>
          <h3 className="text-sm font-semibold text-slate-900 mt-3">{label('Notifications')}</h3>
          <p className="text-xs text-slate-500 mt-1">
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
              <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
                <i className="fa-solid fa-file-invoice-dollar text-emerald-600" />
              </div>
              <i className="fa-solid fa-arrow-right text-slate-300 text-xs" />
            </div>
            <h3 className="text-sm font-semibold text-slate-900 mt-3">{label('Billing')}</h3>
            <p className="text-xs text-slate-500 mt-1">
              {label('Review invoices, payments, and subscription.')}
            </p>
          </Card>
        ) : null}
      </div>

      <Card className="p-5">
        <h3 className="text-sm font-semibold text-slate-900">{label('Need help?')}</h3>
        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
          {label('Contact your warehouse account manager for access changes or billing questions.')}
        </p>
        <a
          href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Client Portal support')}`}
          className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors no-underline"
        >
          <i className="fa-solid fa-envelope text-[10px]" aria-hidden="true" />
          {label('Contact support')}
        </a>
      </Card>
    </div>
  );
}
