import { useMutation, useQuery } from '@tanstack/react-query';
import { FormEvent, useEffect, useState } from 'react';

import {
  DocumentsApi,
  type ContractCatalogRow,
  type DocumentSlotFields,
} from '../../api/documents';
import { Button } from '../Button';
import { Modal } from '../Modal';
import { TextField } from '../TextField';
import { useToast } from '../ToastProvider';
import { useWmsTranslation } from '../../lib/ui-i18n';

type Props = {
  open: boolean;
  row: ContractCatalogRow | null;
  onClose: () => void;
  onSaved: () => void;
};

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
};

export function EditDocumentSlotModal({ open, row, onClose, onSaved }: Props) {
  const { t } = useWmsTranslation();
  const toast = useToast();
  const [fields, setFields] = useState<DocumentSlotFields>(EMPTY);

  const slotQuery = useQuery({
    queryKey: ['document-slot', row?.taskId, row?.type],
    queryFn: () => DocumentsApi.getDocumentSlot(row!.taskId, row!.type),
    enabled: open && !!row,
  });

  useEffect(() => {
    if (slotQuery.data?.fields) {
      setFields(slotQuery.data.fields);
    }
  }, [slotQuery.data]);

  const saveMutation = useMutation({
    mutationFn: (payload: DocumentSlotFields) =>
      DocumentsApi.updateDocumentSlot(row!.taskId, { ...payload, type: row!.type }),
    onSuccess: () => {
      toast.success(t(['Contract fields saved.', 'تم حفظ حقول العقد.']));
      onSaved();
      onClose();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!row) return;
    saveMutation.mutate(fields);
  }

  function setField<K extends keyof DocumentSlotFields>(key: K, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  const isGrn = row?.type === 'grn';
  const title = isGrn
    ? t(['Edit GRN fields', 'تعديل حقول GRN'])
    : t(['Edit delivery note fields', 'تعديل حقول إشعار التسليم']);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      widthClass="max-w-2xl"
      footer={
        <>
          <Button type="button" variant="danger" onClick={onClose}>
            {t(['Cancel', 'إلغاء'])}
          </Button>
          <Button
            type="submit"
            form="edit-document-slot-form"
            loading={saveMutation.isPending || slotQuery.isLoading}
          >
            {t(['Save changes', 'حفظ التغييرات'])}
          </Button>
        </>
      }
    >
      {slotQuery.isLoading ? (
        <p className="text-sm text-text-muted">{t(['Loading…', 'جارٍ التحميل…'])}</p>
      ) : (
        <form id="edit-document-slot-form" onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-text-body">
            {t([
              'Changes apply to the next PDF generation. Re-create PDFs to refresh existing files.',
              'تُطبَّق التغييرات عند إنشاء PDF التالي. أعد إنشاء PDF لتحديث الملفات الحالية.',
            ])}
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label={t(['Client reference', 'مرجع العميل'])}
              value={fields.clientReference}
              onChange={(event) => setField('clientReference', event.target.value)}
              className="sm:col-span-2"
            />
            {isGrn ? (
              <>
                <TextField
                  label={t(['Supplier', 'المورّد'])}
                  value={fields.supplier}
                  onChange={(event) => setField('supplier', event.target.value)}
                />
                <TextField
                  label={t(['PO number', 'رقم أمر الشراء'])}
                  value={fields.poNumber}
                  onChange={(event) => setField('poNumber', event.target.value)}
                />
                <TextField
                  label={t(['Operator', 'المُشغّل'])}
                  value={fields.operatorName}
                  onChange={(event) => setField('operatorName', event.target.value)}
                  className="sm:col-span-2"
                />
              </>
            ) : (
              <>
                <TextField
                  label={t(['Destination', 'الوجهة'])}
                  value={fields.destination}
                  onChange={(event) => setField('destination', event.target.value)}
                  className="sm:col-span-2"
                />
                <TextField
                  label={t(['Carrier', 'الناقل'])}
                  value={fields.carrier}
                  onChange={(event) => setField('carrier', event.target.value)}
                />
                <TextField
                  label={t(['Tracking number', 'رقم التتبّع'])}
                  value={fields.trackingNumber}
                  onChange={(event) => setField('trackingNumber', event.target.value)}
                />
                <TextField
                  label={t(['Vehicle', 'المركبة'])}
                  value={fields.vehicle}
                  onChange={(event) => setField('vehicle', event.target.value)}
                />
                <TextField
                  label={t(['Driver', 'السائق'])}
                  value={fields.driver}
                  onChange={(event) => setField('driver', event.target.value)}
                />
              </>
            )}
            <TextField
              label={t(['Notes', 'ملاحظات'])}
              value={fields.notes}
              onChange={(event) => setField('notes', event.target.value)}
              className="sm:col-span-2"
            />
          </div>
        </form>
      )}
    </Modal>
  );
}
