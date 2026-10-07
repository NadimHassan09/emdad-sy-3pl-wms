import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useUiPreferences } from '@emdad/core'
import { Button } from '@emdad/ui/ui/button'
import { Combobox } from '@emdad/ui/ui/combobox'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@emdad/ui/ui/dialog'
import { Input } from '@emdad/ui/ui/input'
import { Label } from '@emdad/ui/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@emdad/ui/ui/select'
import { CompaniesApi } from '@/api/companies'
import {
  type CreateUserPayload,
  type UpdateUserPayload,
  type UserListRow,
  type UserRole,
  type UserStatus,
} from '@/api/users'
import { QK } from '@/constants/query-keys'
import { useDefaultWarehouseId } from '@/hooks/useDefaultWarehouse'
import {
  canCreateTargetRole,
  canSetOtherUserPassword,
  creatableSystemRoles,
  type SystemRoleUi,
} from '@/lib/rbac'
import { WorkerProfilePanel } from './WorkerProfilePanel'

const CLIENT_ROLE_OPTIONS = [
  { value: 'client_admin', en: 'Client admin', ar: 'مدير عميل' },
  { value: 'client_staff', en: 'Client staff', ar: 'موظف عميل' },
] as const

const SYSTEM_ROLE_CREATE: { value: SystemRoleUi; en: string; ar: string }[] = [
  { value: 'super_admin', en: 'Super admin', ar: 'مدير عام' },
  { value: 'admin', en: 'Admin', ar: 'مدير' },
  { value: 'worker', en: 'Worker', ar: 'عامل' },
]

const SYSTEM_ROLE_EDIT: { value: UserRole; en: string; ar: string }[] = [
  { value: 'super_admin', en: 'Super admin', ar: 'مدير عام' },
  { value: 'wh_manager', en: 'Admin', ar: 'مدير' },
  { value: 'wh_operator', en: 'Worker', ar: 'عامل' },
  { value: 'finance', en: 'Finance', ar: 'مالية' },
]

type CreateProps = {
  open: boolean
  kind: 'system' | 'client'
  actorRole?: string
  onClose: () => void
  loading: boolean
  onSubmit: (payload: CreateUserPayload) => void
}

export function CreateUserDialog({ open, kind, actorRole, onClose, loading, onSubmit }: CreateProps) {
  const { isArabic } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const { warehouseId: defaultWarehouseId } = useDefaultWarehouseId()

  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [systemRole, setSystemRole] = useState<SystemRoleUi>('worker')
  const [clientRole, setClientRole] = useState<'client_admin' | 'client_staff'>('client_staff')
  const [companyId, setCompanyId] = useState('')

  const createSystemRoleOptions = SYSTEM_ROLE_CREATE.filter((opt) =>
    creatableSystemRoles(actorRole).includes(opt.value),
  )

  const companiesQuery = useQuery({
    queryKey: QK.companies,
    queryFn: () => CompaniesApi.list({ includeAll: false }),
    enabled: open && kind === 'client',
  })

  useEffect(() => {
    if (!open) return
    setEmail('')
    setFullName('')
    setPhone('')
    setPassword('')
    setCompanyId('')
    const allowed = creatableSystemRoles(actorRole)
    setSystemRole(allowed.includes('worker') ? 'worker' : (allowed[0] ?? 'worker'))
    setClientRole('client_staff')
  }, [open, kind, actorRole])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const base = {
      email: email.trim(),
      fullName: fullName.trim(),
      phone: phone.trim() || undefined,
      password,
    }
    if (kind === 'system') {
      onSubmit({
        ...base,
        kind: 'system',
        systemRole,
        ...(systemRole === 'worker' && defaultWarehouseId ? { workerWarehouseId: defaultWarehouseId } : {}),
      })
      return
    }
    if (!companyId) return
    onSubmit({
      ...base,
      kind: 'client',
      companyId,
      clientRole,
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !loading && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('New user', 'مستخدم جديد')}</DialogTitle>
        </DialogHeader>
        <form id="create-user" onSubmit={submit} className="space-y-3">
          <Field label={t('Email', 'البريد')} required>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
          <Field label={t('Full name', 'الاسم')} required>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </Field>
          <Field label={t('Phone (optional)', 'الهاتف')}>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
          <Field label={t('Password', 'كلمة المرور')} required>
            <Input type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required />
          </Field>
          {kind === 'system' ? (
            <Field label={t('System role', 'دور النظام')}>
              <Select value={systemRole} onValueChange={(v) => setSystemRole(v as SystemRoleUi)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {createSystemRoleOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {isArabic ? o.ar : o.en}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label>{t('Company', 'الشركة')} *</Label>
                <Combobox
                  value={companyId}
                  onChange={setCompanyId}
                  options={(companiesQuery.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
                  placeholder={t('Search company…', 'ابحث…')}
                />
              </div>
              <Field label={t('Client role', 'دور العميل')}>
                <Select value={clientRole} onValueChange={(v) => setClientRole(v as typeof clientRole)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CLIENT_ROLE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {isArabic ? o.ar : o.en}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </>
          )}
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            {t('Cancel', 'إلغاء')}
          </Button>
          <Button type="submit" form="create-user" disabled={loading || (kind === 'client' && !companyId)}>
            {t('Create', 'إنشاء')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

type EditProps = {
  user: UserListRow | null
  actorRole?: string
  onClose: () => void
  loading: boolean
  onSubmit: (id: string, body: UpdateUserPayload) => void
}

export function EditUserDialog({ user, actorRole, onClose, loading, onSubmit }: EditProps) {
  const { isArabic } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const canResetPassword = canSetOtherUserPassword(actorRole)

  const [editEmail, setEditEmail] = useState('')
  const [editFullName, setEditFullName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editPassword, setEditPassword] = useState('')
  const [editRole, setEditRole] = useState<UserRole>('wh_operator')
  const [editStatus, setEditStatus] = useState<UserStatus>('active')
  const [editCompanyId, setEditCompanyId] = useState('')

  const companiesQuery = useQuery({
    queryKey: QK.companies,
    queryFn: () => CompaniesApi.list({ includeAll: false }),
    enabled: !!user,
  })

  useEffect(() => {
    if (!user) return
    setEditEmail(user.email)
    setEditFullName(user.fullName)
    setEditPhone(user.phone ?? '')
    setEditPassword('')
    setEditRole(user.role)
    setEditStatus(user.status)
    setEditCompanyId(user.companyId ?? '')
  }, [user])

  if (!user) return null

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const body: UpdateUserPayload = {
      email: editEmail.trim(),
      fullName: editFullName.trim(),
      role: editRole,
      status: editStatus,
    }
    const ph = editPhone.trim()
    if (ph) body.phone = ph
    if (canResetPassword && editPassword.trim()) body.password = editPassword
    if (user.kind === 'client' && editCompanyId) body.companyId = editCompanyId
    onSubmit(user.id, body)
  }

  const roleOptions =
    user.kind === 'system'
      ? SYSTEM_ROLE_EDIT.filter((opt) => opt.value === user.role || canCreateTargetRole(actorRole, opt.value))
      : CLIENT_ROLE_OPTIONS.filter((opt) => opt.value === user.role || canCreateTargetRole(actorRole, opt.value))

  return (
    <Dialog open onOpenChange={(v) => !v && !loading && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {t('Edit', 'تعديل')} {user.email}
          </DialogTitle>
        </DialogHeader>
        <form id="edit-user" onSubmit={submit} className="space-y-3">
          <Field label={t('Email', 'البريد')} required>
            <Input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} required />
          </Field>
          <Field label={t('Full name', 'الاسم')} required>
            <Input value={editFullName} onChange={(e) => setEditFullName(e.target.value)} required />
          </Field>
          <Field label={t('Phone', 'الهاتف')}>
            <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
          </Field>
          <Field label={t('Status', 'الحالة')}>
            <Select value={editStatus} onValueChange={(v) => setEditStatus(v as UserStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">{t('Active', 'نشط')}</SelectItem>
                <SelectItem value="inactive">{t('Inactive', 'غير نشط')}</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label={user.kind === 'system' ? t('System role', 'دور النظام') : t('Client role', 'دور العميل')}>
            <Select value={editRole} onValueChange={(v) => setEditRole(v as UserRole)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roleOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {isArabic ? o.ar : o.en}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {user.kind === 'client' ? (
            <div className="space-y-1.5">
              <Label>{t('Company', 'الشركة')} *</Label>
              <Combobox
                value={editCompanyId}
                onChange={setEditCompanyId}
                options={(companiesQuery.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
                placeholder={t('Search company…', 'ابحث…')}
              />
            </div>
          ) : null}
          {canResetPassword ? (
            <Field label={t('New password (optional)', 'كلمة مرور جديدة')}>
              <Input type="password" value={editPassword} onChange={(e) => setEditPassword(e.target.value)} autoComplete="new-password" />
            </Field>
          ) : null}
          {user.kind === 'system' && editRole === 'wh_operator' ? (
            <WorkerProfilePanel user={{ ...user, role: editRole, status: editStatus }} compact />
          ) : null}
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            {t('Cancel', 'إلغاء')}
          </Button>
          <Button type="submit" form="edit-user" disabled={loading}>
            {t('Save', 'حفظ')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      {children}
    </div>
  )
}
