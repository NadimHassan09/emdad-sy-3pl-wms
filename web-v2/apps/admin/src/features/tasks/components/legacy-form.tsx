import { Label } from '@emdad/ui/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@emdad/ui/ui/select'

export function SelectField({
  label,
  name,
  value,
  onChange,
  options,
}: {
  label: string
  name?: string
  value: string
  onChange: (e: { target: { value: string } }) => void
  options: Array<{ value: string; label: string }>
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Select value={value || '__empty__'} onValueChange={(v) => onChange({ target: { value: v === '__empty__' ? '' : v } })}>
        <SelectTrigger id={name} className="text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value || '__empty__'} value={o.value || '__empty__'}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
