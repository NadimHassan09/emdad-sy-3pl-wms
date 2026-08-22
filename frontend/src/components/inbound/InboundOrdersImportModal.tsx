import { useMutation } from '@tanstack/react-query';
import { useRef, useState, type ChangeEvent } from 'react';

import { Button } from '@ds';

import {
  InboundApi,
  type InboundImportExecuteResult,
  type InboundImportValidateResult,
} from '../../api/inbound';
import { Modal } from '../Modal';
import { useToast } from '../ToastProvider';
import { useWmsTranslation } from '../../lib/ui-i18n';

type Props = {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
};

function errorsToCsv(errors: { rowNumber: number; externalReference: string | null; reason: string }[]): string {
  const lines = ['row_number,external_reference,reason'];
  for (const e of errors) {
    const ref = (e.externalReference ?? '').replace(/"/g, '""');
    const reason = e.reason.replace(/"/g, '""');
    lines.push(`${e.rowNumber},"${ref}","${reason}"`);
  }
  return `\uFEFF${lines.join('\n')}`;
}

function downloadText(filename: string, body: string): void {
  const blob = new Blob([body], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function InboundOrdersImportModal({ open, onClose, onImported }: Props) {
  const toast = useToast();
  const { t } = useWmsTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [validation, setValidation] = useState<InboundImportValidateResult | null>(null);
  const [result, setResult] = useState<InboundImportExecuteResult | null>(null);

  const reset = () => {
    setFile(null);
    setValidation(null);
    setResult(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const close = () => {
    if (validateMut.isPending || importMut.isPending) return;
    reset();
    onClose();
  };

  const validateMut = useMutation({
    mutationFn: (f: File) => InboundApi.validateImport(f),
    onSuccess: (data) => {
      setValidation(data);
      setResult(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const importMut = useMutation({
    mutationFn: (f: File) => InboundApi.importOrders(f),
    onSuccess: (data) => {
      setResult(data);
      toast.success(
        t([
          `Imported ${data.imported} order(s). Failed: ${data.failed}.`,
          `تم استيراد ${data.imported} طلب/طلبات. فشل: ${data.failed}.`,
        ]),
      );
      onImported();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const next = e.target.files?.[0] ?? null;
    setFile(next);
    setValidation(null);
    setResult(null);
  };

  const busy = validateMut.isPending || importMut.isPending;

  return (
    <Modal
      open={open}
      onClose={close}
      title={t(['Import inbound orders', 'استيراد طلبات الوارد'])}
      widthClass="max-w-2xl"
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={close} disabled={busy}>
            {t(['Close', 'إغلاق'])}
          </Button>
          <Button
            variant="secondary"
            disabled={!file || busy}
            loading={validateMut.isPending}
            onClick={() => file && validateMut.mutate(file)}
          >
            {t(['Validate', 'تحقق'])}
          </Button>
          <Button
            variant="primary"
            disabled={!file || busy || (validation != null && validation.validOrders === 0)}
            loading={importMut.isPending}
            onClick={() => file && importMut.mutate(file)}
          >
            {t(['Import valid orders', 'استيراد الطلبات الصالحة'])}
          </Button>
        </div>
      }
    >
      <div className="space-y-4 text-sm text-text-body">
        <p>
          {t([
            'Upload a CSV to create inbound orders in Draft (workers mode). Orders are not confirmed and no receive or putaway tasks are started.',
            'ارفع ملف CSV لإنشاء طلبات وارد بحالة مسودة (وضع العمال). لن يتم التأكيد ولن تُبدأ مهام الاستلام أو التخزين.',
          ])}
        </p>
        <p className="text-xs text-text-muted">
          {t([
            'One row per product line. Rows sharing the same external_reference (+ company_id) become one multi-line order.',
            'صف لكل منتج. الصفوف بنفس external_reference (+ company_id) تُجمَّع في طلب واحد متعدد الأسطر.',
          ])}
        </p>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              void InboundApi.downloadImportTemplate().catch((err: Error) => toast.error(err.message));
            }}
          >
            {t(['Download CSV Template', 'تنزيل قالب CSV'])}
          </Button>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={onFile}
          className="block w-full text-sm"
        />
        {file ? (
          <p className="text-xs text-text-muted">
            {file.name} ({Math.round(file.size / 1024)} KB)
          </p>
        ) : null}

        {validation ? (
          <div className="rounded-lg border border-border bg-surface-sunken p-3">
            <p className="font-semibold text-text-strong">{t(['Validation', 'التحقق'])}</p>
            <ul className="mt-2 list-inside list-disc text-xs">
              <li>
                {t(['Total rows', 'إجمالي الصفوف'])}: {validation.totalRows}
              </li>
              <li>
                {t(['Orders', 'الطلبات'])}: {validation.orderCount}
              </li>
              <li>
                {t(['Valid orders', 'طلبات صالحة'])}: {validation.validOrders}
              </li>
              <li>
                {t(['Invalid orders', 'طلبات غير صالحة'])}: {validation.invalidOrders}
              </li>
              <li>
                {t(['Duplicates in DB', 'مكررات في قاعدة البيانات'])}: {validation.duplicateInDb}
              </li>
            </ul>
            {validation.errors.length > 0 ? (
              <div className="mt-3 max-h-40 overflow-auto rounded border border-border bg-surface-card p-2 text-xs">
                {validation.errors.slice(0, 50).map((e, i) => (
                  <p key={`${e.rowNumber}-${i}`}>
                    Row {e.rowNumber}
                    {e.externalReference ? ` (${e.externalReference})` : ''}: {e.reason}
                  </p>
                ))}
                {validation.errors.length > 50 ? (
                  <p>… +{validation.errors.length - 50} more</p>
                ) : null}
              </div>
            ) : null}
            {validation.errors.length > 0 ? (
              <Button
                className="mt-2"
                variant="secondary"
                size="sm"
                onClick={() =>
                  downloadText('inbound-import-validation-errors.csv', errorsToCsv(validation.errors))
                }
              >
                {t(['Download errors CSV', 'تنزيل أخطاء CSV'])}
              </Button>
            ) : null}
          </div>
        ) : null}

        {result ? (
          <div className="rounded-lg border border-status-success-border bg-status-success-bg p-3 text-status-success-fg">
            <p className="font-semibold">
              {t(['Import summary', 'ملخص الاستيراد'])}
            </p>
            <ul className="mt-2 list-inside list-disc text-xs">
              <li>
                {t(['Imported successfully', 'تم الاستيراد بنجاح'])}: {result.imported}
              </li>
              <li>
                {t(['Failed', 'فشل'])}: {result.failed}
              </li>
              <li>
                {t(['Skipped duplicates', 'تم تخطي المكررات'])}: {result.skippedDuplicates}
              </li>
            </ul>
            {result.createdOrderNumbers.length > 0 ? (
              <p className="mt-2 text-xs">
                {result.createdOrderNumbers.slice(0, 12).join(', ')}
                {result.createdOrderNumbers.length > 12
                  ? ` … +${result.createdOrderNumbers.length - 12}`
                  : ''}
              </p>
            ) : null}
            {result.errors.length > 0 ? (
              <Button
                className="mt-2"
                variant="secondary"
                size="sm"
                onClick={() =>
                  downloadText('inbound-import-errors.csv', errorsToCsv(result.errors))
                }
              >
                {t(['Download errors CSV', 'تنزيل أخطاء CSV'])}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
