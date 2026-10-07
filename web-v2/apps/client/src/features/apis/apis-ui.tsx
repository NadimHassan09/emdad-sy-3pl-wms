import { StatusBadge, type Tone } from '@emdad/ui'
import type { ClientApiScope, ClientApiStatus } from '@/services/clientApisService'

export const API_SCOPES: ClientApiScope[] = ['oms', 'inbound', 'outbound']

export const SCOPE_META: Record<
  ClientApiScope,
  { en: string; ar: string; hint: string; hintAr: string }
> = {
  oms: {
    en: 'OMS Orders',
    ar: 'طلبات إلكترونية',
    hint: 'Create and read online (OMS) orders.',
    hintAr: 'إنشاء وقراءة الطلبات الإلكترونية.',
  },
  inbound: {
    en: 'Inbound Orders',
    ar: 'طلبات وارد',
    hint: 'Create and read inbound receipts.',
    hintAr: 'إنشاء وقراءة طلبات الوارد.',
  },
  outbound: {
    en: 'Outbound Orders',
    ar: 'طلبات صادر',
    hint: 'Create and read warehouse outbound orders.',
    hintAr: 'إنشاء وقراءة طلبات الصادر.',
  },
}

const STATUS_TONE: Record<ClientApiStatus, Tone> = {
  active: 'success',
  disabled: 'warning',
  revoked: 'danger',
}

export function apiStatusLabel(status: ClientApiStatus, isArabic: boolean): string {
  if (status === 'active') return isArabic ? 'نشط' : 'Active'
  if (status === 'disabled') return isArabic ? 'متوقف' : 'Disabled'
  return isArabic ? 'ملغى' : 'Revoked'
}

export function ApiStatusBadge({ status, isArabic }: { status: ClientApiStatus; isArabic: boolean }) {
  return <StatusBadge tone={STATUS_TONE[status]}>{apiStatusLabel(status, isArabic)}</StatusBadge>
}

export function scopeLabel(scope: ClientApiScope, isArabic: boolean): string {
  return isArabic ? SCOPE_META[scope].ar : SCOPE_META[scope].en
}

export const CLIENT_APIS_QUERY_KEY = ['client-apis'] as const
