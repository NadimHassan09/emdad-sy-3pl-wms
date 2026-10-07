import { useMemo } from 'react'
import { Label } from '@emdad/ui/ui/label'
import { Input } from '@emdad/ui/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@emdad/ui/ui/select'
import { cn } from '@emdad/ui'
import {
  DEFAULT_PHONE_COUNTRY,
  evaluateRecipientPhone,
  filterNationalPhoneInput,
  filterRecipientNameInput,
  isValidRecipientName,
  listCountryDialOptions,
  recipientNameErrorMessage,
  recipientPhoneErrorMessage,
  countryDisplayName,
  type PhoneEvaluation,
} from '@/lib/recipient-contact'

export type RecipientPhoneState = {
  countryIso: string
  nationalNumber: string
}

export function emptyRecipientPhone(iso = DEFAULT_PHONE_COUNTRY): RecipientPhoneState {
  return { countryIso: iso, nationalNumber: '' }
}

export function evaluatePhone(state: RecipientPhoneState): PhoneEvaluation {
  return evaluateRecipientPhone(state.countryIso, state.nationalNumber)
}

type NameProps = {
  id?: string
  label: string
  value: string
  onChange: (v: string) => void
  disabled?: boolean
  submitted?: boolean
  required?: boolean
  isArabic: boolean
}

export function OmsRecipientNameField({
  id = 'oms-recipient-name',
  label,
  value,
  onChange,
  disabled,
  submitted,
  required,
  isArabic,
}: NameProps) {
  const invalid = submitted && value.trim() !== '' && !isValidRecipientName(value)
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-sm">
        {label}
        {required ? <span className="text-destructive ms-0.5">*</span> : null}
      </Label>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(filterRecipientNameInput(e.target.value))}
        disabled={disabled}
        required={required}
        aria-invalid={invalid}
        className={cn('text-sm', invalid && 'border-destructive')}
      />
      {invalid ? (
        <p className="text-sm text-destructive" role="alert">
          {recipientNameErrorMessage(isArabic)}
        </p>
      ) : null}
    </div>
  )
}

type PhoneProps = {
  id?: string
  label: string
  value: RecipientPhoneState
  onChange: (v: RecipientPhoneState) => void
  disabled?: boolean
  submitted?: boolean
  required?: boolean
  isArabic: boolean
}

export function OmsRecipientPhoneField({
  id = 'oms-recipient-phone',
  label,
  value,
  onChange,
  disabled,
  submitted,
  required,
  isArabic,
}: PhoneProps) {
  const locale = isArabic ? 'ar' : 'en'
  const countries = useMemo(() => listCountryDialOptions(locale), [locale])
  const evalResult = evaluatePhone(value)
  const showError = submitted && required && (!evalResult.isValid || evalResult.isEmpty)

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-sm">
        {label}
        {required ? <span className="text-destructive ms-0.5">*</span> : null}
      </Label>
      <div className="flex gap-2">
        <Select
          value={value.countryIso || DEFAULT_PHONE_COUNTRY}
          onValueChange={(iso) => onChange({ ...value, countryIso: iso })}
          disabled={disabled}
        >
          <SelectTrigger
            className="w-36 shrink-0 text-sm"
            aria-label={isArabic ? 'رمز الدولة' : 'Country code'}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {countries.map((c) => (
              <SelectItem key={c.iso} value={c.iso} className="text-sm">
                {c.flag} +{c.callingCode}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          id={id}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          value={value.nationalNumber}
          onChange={(e) =>
            onChange({ ...value, nationalNumber: filterNationalPhoneInput(e.target.value) })
          }
          disabled={disabled}
          required={required}
          aria-invalid={showError}
          className={cn('min-w-0 flex-1 text-sm', showError && 'border-destructive')}
          placeholder={isArabic ? 'رقم الهاتف' : 'Phone number'}
        />
      </div>
      {showError ? (
        <p className="text-sm text-destructive" role="alert">
          {recipientPhoneErrorMessage(countryDisplayName(value.countryIso, locale), isArabic)}
        </p>
      ) : null}
    </div>
  )
}
