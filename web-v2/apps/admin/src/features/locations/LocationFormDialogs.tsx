import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useUiPreferences } from '@emdad/core'
import { Button } from '@emdad/ui/ui/button'
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
import {
  type CreateLocationInput,
  type Location,
  type LocationType,
  type UpdateLocationInput,
  LocationsApi,
} from '@/api/locations'
import { QK } from '@/constants/query-keys'
import { locationTypeSupportsCapacityFields, managedLocationTypeOptions } from '@/lib/location-types'

function parseOptionalPositiveDecimal(s: string): number | undefined {
  const t = s.trim()
  if (!t) return undefined
  const n = Number(t)
  return Number.isFinite(n) && n >= 0 ? n : undefined
}

type CreateProps = {
  open: boolean
  onClose: () => void
  loading: boolean
  warehouseId: string | undefined
  defaultParentId: string | null
  onSubmit: (input: CreateLocationInput) => void
}

export function CreateLocationDialog({
  open,
  onClose,
  loading,
  warehouseId,
  defaultParentId,
  onSubmit,
}: CreateProps) {
  const { isArabic } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)

  const [name, setName] = useState('')
  const [type, setType] = useState<LocationType>('internal')
  const [barcode, setBarcode] = useState('')
  const [parentId, setParentId] = useState('')
  const [maxWeightKg, setMaxWeightKg] = useState('')
  const [maxCbm, setMaxCbm] = useState('')

  const parentLookup = useQuery({
    queryKey: QK.locations.lookup(warehouseId ?? '', 'parent-picker'),
    queryFn: () => LocationsApi.lookup({ warehouseId: warehouseId!, limit: 200 }),
    enabled: open && !!warehouseId,
  })

  const parentOptions = useMemo(
    () => [
      { value: '', label: t('Root (warehouse)', 'الجذر (المستودع)') },
      ...(parentLookup.data?.items ?? []).map((loc) => ({
        value: loc.id,
        label: loc.fullPath || loc.name,
      })),
    ],
    [parentLookup.data, isArabic], // eslint-disable-line react-hooks/exhaustive-deps
  )

  useEffect(() => {
    if (!open) {
      setName('')
      setType('internal')
      setBarcode('')
      setParentId(defaultParentId ?? '')
      setMaxWeightKg('')
      setMaxCbm('')
    } else {
      setParentId(defaultParentId ?? '')
    }
  }, [open, defaultParentId])

  const showCapacity = locationTypeSupportsCapacityFields(type)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!warehouseId) return
    const input: CreateLocationInput = {
      warehouseId,
      name: name.trim(),
      type,
      barcode: barcode.trim() || undefined,
      parentId: parentId.trim() || undefined,
    }
    const w = parseOptionalPositiveDecimal(maxWeightKg)
    const c = parseOptionalPositiveDecimal(maxCbm)
    if (w !== undefined) input.maxWeightKg = w
    if (c !== undefined) input.maxCbm = c
    onSubmit(input)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !loading && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('New location', 'موقع جديد')}</DialogTitle>
        </DialogHeader>
        <form id="create-location" onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>{t('Name', 'الاسم')} *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>{t('Parent', 'الأب')}</Label>
            <Select value={parentId || '__root__'} onValueChange={(v) => setParentId(v === '__root__' ? '' : v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {parentOptions.map((o) => (
                  <SelectItem key={o.value || '__root__'} value={o.value || '__root__'}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t('Type', 'النوع')}</Label>
            <Select value={type} onValueChange={(v) => setType(v as LocationType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {managedLocationTypeOptions(isArabic).map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t('Barcode (optional)', 'Barcode (اختياري)')}</Label>
            <Input value={barcode} onChange={(e) => setBarcode(e.target.value)} className="font-mono" />
          </div>
          {showCapacity ? (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label>{t('Max weight (kg)', 'أقصى وزن')}</Label>
                <Input value={maxWeightKg} onChange={(e) => setMaxWeightKg(e.target.value)} type="number" min={0} />
              </div>
              <div className="space-y-1.5">
                <Label>{t('Max CBM', 'أقصى حجم')}</Label>
                <Input value={maxCbm} onChange={(e) => setMaxCbm(e.target.value)} type="number" min={0} />
              </div>
            </div>
          ) : null}
        </form>
        <DialogFooter>
          <Button type="button" variant="ghost" disabled={loading} onClick={onClose}>
            {t('Cancel', 'إلغاء')}
          </Button>
          <Button type="submit" form="create-location" disabled={loading || !warehouseId || !name.trim()}>
            {t('Create', 'إنشاء')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

type EditProps = {
  open: boolean
  location: Location | null
  loading: boolean
  onClose: () => void
  onSubmit: (patch: UpdateLocationInput) => void
}

export function EditLocationDialog({ open, location, loading, onClose, onSubmit }: EditProps) {
  const { isArabic } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)

  const [name, setName] = useState('')
  const [type, setType] = useState<LocationType>('internal')
  const [barcode, setBarcode] = useState('')
  const [status, setStatus] = useState<'active' | 'blocked'>('active')
  const [maxWeightKg, setMaxWeightKg] = useState('')
  const [maxCbm, setMaxCbm] = useState('')

  useEffect(() => {
    if (!location || !open) return
    setName(location.name)
    setType(location.type)
    setBarcode(location.barcode)
    setStatus(location.status === 'blocked' ? 'blocked' : 'active')
    setMaxWeightKg(location.maxWeightKg != null ? String(location.maxWeightKg) : '')
    setMaxCbm(location.maxCbm != null ? String(location.maxCbm) : '')
  }, [location, open])

  const showCapacity = locationTypeSupportsCapacityFields(type)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const patch: UpdateLocationInput = {
      name: name.trim(),
      type,
      barcode: barcode.trim(),
      status,
    }
    const w = parseOptionalPositiveDecimal(maxWeightKg)
    const c = parseOptionalPositiveDecimal(maxCbm)
    if (w !== undefined) patch.maxWeightKg = w
    if (c !== undefined) patch.maxCbm = c
    onSubmit(patch)
  }

  return (
    <Dialog open={open && !!location} onOpenChange={(v) => !v && !loading && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('Edit location', 'تعديل الموقع')}</DialogTitle>
        </DialogHeader>
        <form id="edit-location" onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>{t('Name', 'الاسم')}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>{t('Type', 'النوع')}</Label>
            <Select value={type} onValueChange={(v) => setType(v as LocationType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {managedLocationTypeOptions(isArabic).map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Barcode</Label>
            <Input value={barcode} onChange={(e) => setBarcode(e.target.value)} className="font-mono" />
          </div>
          <div className="space-y-1.5">
            <Label>{t('Status', 'الحالة')}</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as 'active' | 'blocked')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">{t('Active', 'نشط')}</SelectItem>
                <SelectItem value="blocked">{t('Suspended', 'موقوف')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {showCapacity ? (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label>{t('Max weight (kg)', 'أقصى وزن')}</Label>
                <Input value={maxWeightKg} onChange={(e) => setMaxWeightKg(e.target.value)} type="number" min={0} />
              </div>
              <div className="space-y-1.5">
                <Label>{t('Max CBM', 'أقصى حجم')}</Label>
                <Input value={maxCbm} onChange={(e) => setMaxCbm(e.target.value)} type="number" min={0} />
              </div>
            </div>
          ) : null}
        </form>
        <DialogFooter>
          <Button type="button" variant="ghost" disabled={loading} onClick={onClose}>
            {t('Cancel', 'إلغاء')}
          </Button>
          <Button type="submit" form="edit-location" disabled={loading}>
            {t('Save', 'حفظ')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
