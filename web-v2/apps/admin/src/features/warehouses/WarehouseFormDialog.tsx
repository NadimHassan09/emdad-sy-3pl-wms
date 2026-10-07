import { useEffect, useMemo, useState, type FormEvent } from 'react'
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
  type CreateWarehouseInput,
  type UpdateWarehouseInput,
  type Warehouse,
} from '@/api/warehouses'
import { COUNTRIES, OTHER_COUNTRY } from '@/lib/geography'

type CreateProps = {
  mode: 'create'
  open: boolean
  onClose: () => void
  loading: boolean
  onSubmit: (input: CreateWarehouseInput) => void
}

type EditProps = {
  mode: 'edit'
  open: boolean
  warehouse: Warehouse | null
  onClose: () => void
  loading: boolean
  onSubmit: (input: UpdateWarehouseInput) => void
}

export function WarehouseFormDialog(props: CreateProps | EditProps) {
  const { isArabic } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)

  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [address, setAddress] = useState('')
  const [countryCode, setCountryCode] = useState('SA')
  const [city, setCity] = useState('')
  const [cityOther, setCityOther] = useState('')

  const country = useMemo(
    () => COUNTRIES.find((c) => c.code === countryCode) ?? COUNTRIES[0]!,
    [countryCode],
  )

  useEffect(() => {
    if (!props.open) {
      setName('')
      setCode('')
      setAddress('')
      setCountryCode('SA')
      setCity('')
      setCityOther('')
      return
    }
    if (props.mode === 'edit' && props.warehouse) {
      const w = props.warehouse
      setName(w.name)
      setCode(w.code)
      setAddress(w.address ?? '')
      const match = COUNTRIES.find((c) => c.name === w.country || c.code === w.country)
      setCountryCode(match?.code ?? OTHER_COUNTRY)
      const c = w.city ?? ''
      if (match && match.cities.includes(c)) {
        setCity(c)
        setCityOther('')
      } else {
        setCity(OTHER_COUNTRY)
        setCityOther(c)
      }
    }
  }, [props.open, props.mode, props.mode === 'edit' ? props.warehouse : null])

  const resolvedCity =
    countryCode === OTHER_COUNTRY || city === OTHER_COUNTRY ? cityOther.trim() : city.trim()

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const countryName =
      countryCode === OTHER_COUNTRY ? t('Other', 'أخرى') : (COUNTRIES.find((c) => c.code === countryCode)?.name ?? country.name)
    if (props.mode === 'create') {
      props.onSubmit({
        name: name.trim(),
        code: code.trim() || undefined,
        address: address.trim() || undefined,
        city: resolvedCity || undefined,
        country: countryName,
      })
    } else {
      props.onSubmit({
        name: name.trim(),
        address: address.trim() || undefined,
        city: resolvedCity || undefined,
        country: countryName,
      })
    }
  }

  const title = props.mode === 'create' ? t('New warehouse', 'مستودع جديد') : t('Edit warehouse', 'تعديل المستودع')
  const formId = props.mode === 'create' ? 'create-warehouse' : 'edit-warehouse'

  return (
    <Dialog
      open={props.open && (props.mode === 'create' || !!props.warehouse)}
      onOpenChange={(v) => !v && !props.loading && props.onClose()}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form id={formId} onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>{t('Name', 'الاسم')} *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          {props.mode === 'create' ? (
            <div className="space-y-1.5">
              <Label>{t('Code (optional)', 'الرمز (اختياري)')}</Label>
              <Input value={code} onChange={(e) => setCode(e.target.value)} className="font-mono uppercase" />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>{t('Code', 'الرمز')}</Label>
              <Input value={code} disabled className="font-mono" />
            </div>
          )}
          <div className="space-y-1.5">
            <Label>{t('Address', 'العنوان')}</Label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t('Country', 'الدولة')}</Label>
            <Select value={countryCode} onValueChange={setCountryCode}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COUNTRIES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.name}
                  </SelectItem>
                ))}
                <SelectItem value={OTHER_COUNTRY}>{t('Other', 'أخرى')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t('City', 'المدينة')}</Label>
            {countryCode !== OTHER_COUNTRY ? (
              <Select value={city || country.cities[0]} onValueChange={setCity}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {country.cities.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                  <SelectItem value={OTHER_COUNTRY}>{t('Other', 'أخرى')}</SelectItem>
                </SelectContent>
              </Select>
            ) : null}
            {(countryCode === OTHER_COUNTRY || city === OTHER_COUNTRY) && (
              <Input
                value={cityOther}
                onChange={(e) => setCityOther(e.target.value)}
                placeholder={t('City name', 'اسم المدينة')}
              />
            )}
          </div>
        </form>
        <DialogFooter>
          <Button type="button" variant="ghost" disabled={props.loading} onClick={props.onClose}>
            {t('Cancel', 'إلغاء')}
          </Button>
          <Button type="submit" form={formId} disabled={props.loading || !name.trim()}>
            {props.mode === 'create' ? t('Create', 'إنشاء') : t('Save', 'حفظ')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
