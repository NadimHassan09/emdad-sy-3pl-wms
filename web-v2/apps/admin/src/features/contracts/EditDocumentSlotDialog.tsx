import { useEffect, useState, type FormEvent } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
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
import { toast } from 'sonner'
import {
  DocumentsApi,
  type ContractCatalogRow,
  type DocumentSlotFields,
} from '@/api/documents'

const EMPTY: DocumentSlotFields = {
  clientReference: '',
  notes: '',
  supplier: '',
  poNumber: '',
  operatorName: '',
  destination: '',
  carrier: '',
  trackingNumber: '',
  vehicle: '',
  driver: '',
}

export function EditDocumentSlotDialog({
  open,
  row,
  onClose,
  onSaved,
}: {
  open: boolean
  row: ContractCatalogRow | null
  onClose: () => void
  onSaved: () => void
}) {
  const { isArabic } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const [fields, setFields] = useState<DocumentSlotFields>(EMPTY)

  const slotQuery = useQuery({
    queryKey: ['document-slot', row?.taskId, row?.type],
    queryFn: () => DocumentsApi.getDocumentSlot(row!.taskId, row!.type),
    enabled: open && !!row,
  })

  useEffect(() => {
    if (slotQuery.data?.fields) setFields(slotQuery.data.fields)
  }, [slotQuery.data])

  const saveMutation = useMutation({
    mutationFn: (payload: DocumentSlotFields) =>
      DocumentsApi.updateDocumentSlot(row!.taskId, { ...payload, type: row!.type }),
    onSuccess: () => {
      toast.success(t('Contract fields saved.', 'تم حفظ حقول العقد.'))
      onSaved()
      onClose()
    },
    onError: (error: Error) => toast.error(error.message),
  })

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!row) return
    saveMutation.mutate(fields)
  }

  function setField<K extends keyof DocumentSlotFields>(key: K, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }))
  }

  const isGrn = row?.type === 'grn'
  const title = isGrn
    ? t('Edit GRN fields', 'تعديل حقول GRN')
    : t('Edit delivery note fields', 'تعديل حقول إشعار التسليم')

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {slotQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">{t('Loading…', 'جارٍ التحميل…')}</p>
        ) : (
          <form id="edit-document-slot-form" onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t(
                'Changes apply to the next PDF generation. Re-create PDFs to refresh existing files.',
                'تُطبَّق التغييرات عند إنشاء PDF التالي. أعد إنشاء PDF لتحديث الملفات الحالية.',
              )}
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label>{t('Client reference', 'مرجع العميل')}</Label>
                <Input
                  value={fields.clientReference}
                  onChange={(e) => setField('clientReference', e.target.value)}
                />
              </div>
              {isGrn ? (
                <>
                  <div className="space-y-2">
                    <Label>{t('Supplier', 'المورّد')}</Label>
                    <Input value={fields.supplier} onChange={(e) => setField('supplier', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('PO number', 'رقم أمر الشراء')}</Label>
                    <Input value={fields.poNumber} onChange={(e) => setField('poNumber', e.target.value)} />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>{t('Operator', 'المُشغّل')}</Label>
                    <Input
                      value={fields.operatorName}
                      onChange={(e) => setField('operatorName', e.target.value)}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>{t('Destination', 'الوجهة')}</Label>
                    <Input
                      value={fields.destination}
                      onChange={(e) => setField('destination', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('Carrier', 'الناقل')}</Label>
                    <Input value={fields.carrier} onChange={(e) => setField('carrier', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('Tracking number', 'رقم التتبّع')}</Label>
                    <Input
                      value={fields.trackingNumber}
                      onChange={(e) => setField('trackingNumber', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('Vehicle', 'المركبة')}</Label>
                    <Input value={fields.vehicle} onChange={(e) => setField('vehicle', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('Driver', 'السائق')}</Label>
                    <Input value={fields.driver} onChange={(e) => setField('driver', e.target.value)} />
                  </div>
                </>
              )}
              <div className="space-y-2 sm:col-span-2">
                <Label>{t('Notes', 'ملاحظات')}</Label>
                <Input value={fields.notes} onChange={(e) => setField('notes', e.target.value)} />
              </div>
            </div>
          </form>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {t('Cancel', 'إلغاء')}
          </Button>
          <Button
            type="submit"
            form="edit-document-slot-form"
            disabled={saveMutation.isPending || slotQuery.isLoading}
          >
            {t('Save changes', 'حفظ التغييرات')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
