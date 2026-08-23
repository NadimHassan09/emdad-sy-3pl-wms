import { useMutation } from '@tanstack/react-query';
import { useRef, useState, type ChangeEvent, type ReactElement } from 'react';

import { Alert, Button, Modal } from '@ds';

import { isClientArabic } from '../lib/client-ui-language';
import {
  downloadClientImportTemplate,
  downloadImportErrors,
  importClientOrders,
  type ClientOrderImportKind,
  type ClientOrderImportSummary,
} from '../services/clientOrderImport';

type Props = {
  kind: ClientOrderImportKind;
  open: boolean;
  onClose: () => void;
  onImported: () => void;
  disabled?: boolean;
  disabledReason?: string;
};

function kindTitle(kind: ClientOrderImportKind, isArabic: boolean): string {
  if (kind === 'oms') return isArabic ? 'استيراد الطلبات الإلكترونية' : 'Import online orders';
  if (kind === 'inbound') return isArabic ? 'استيراد طلبات الوارد' : 'Import inbound orders';
  return isArabic ? 'استيراد طلبات الصادر' : 'Import outbound orders';
}

export function ClientOrderImportModal({
  kind,
  open,
  onClose,
  onImported,
  disabled,
  disabledReason,
}: Props): ReactElement {
  const isArabic = isClientArabic();
  const t = (en: string, ar: string) => (isArabic ? ar : en);
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ClientOrderImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setFile(null);
    setResult(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const close = () => {
    if (importMut.isPending) return;
    reset();
    onClose();
  };

  const templateMut = useMutation({
    mutationFn: () => downloadClientImportTemplate(kind),
    onError: (err: Error) => setError(err.message),
  });

  const importMut = useMutation({
    mutationFn: (f: File) => importClientOrders(kind, f),
    onSuccess: (data) => {
      setResult(data);
      setError(null);
      onImported();
    },
    onError: (err: Error) => setError(err.message),
  });

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    setFile(e.target.files?.[0] ?? null);
    setResult(null);
    setError(null);
  };

  const busy = importMut.isPending || templateMut.isPending;

  return (
    <Modal
      open={open}
      onClose={close}
      title={kindTitle(kind, isArabic)}
      widthClass="max-w-2xl"
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={close} disabled={importMut.isPending}>
            {t('Close', 'إغلاق')}
          </Button>
          <Button
            variant="primary"
            disabled={!file || busy || disabled}
            loading={importMut.isPending}
            onClick={() => file && importMut.mutate(file)}
          >
            {t('Import', 'استيراد')}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {disabled ? (
          <Alert variant="warning">{disabledReason || t('Import is currently unavailable.', 'الاستيراد غير متاح حالياً.')}</Alert>
        ) : null}
        <p className="text-sm text-text-muted">
          {kind === 'oms' || kind === 'inbound'
            ? t(
                'Upload a CSV/Excel file. Every row must be complete and valid (same rules as Create order). Invalid rows are rejected. Rows with the same order_number become one order with multiple lines.',
                'ارفع ملف CSV/Excel. يجب أن يكون كل صف مكتملًا وصحيحًا (نفس قواعد إنشاء الطلب). الصفوف غير الصالحة تُرفض. الصفوف بنفس order_number تُجمَّع في طلب واحد بعدة أصناف.',
              )
            : t(
                'Upload an Excel or CSV file. Multiple rows with the same order number become one order with multiple product lines.',
                'ارفع ملف Excel أو CSV. الصفوف التي تحمل نفس رقم الطلب تُجمَّع في طلب واحد بعدة أصناف.',
              )}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            disabled={busy}
            loading={templateMut.isPending}
            onClick={() => templateMut.mutate()}
          >
            {t('Download template', 'تنزيل القالب')}
          </Button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={onFile}
          disabled={busy || disabled}
          className="block w-full text-sm text-text-body file:mr-3 file:rounded-lg file:border-0 file:bg-surface-card-muted file:px-3 file:py-2 file:text-sm file:font-medium"
        />
        {file ? (
          <p className="text-xs text-text-muted">
            {file.name} ({Math.ceil(file.size / 1024)} KB)
          </p>
        ) : null}
        {error ? <Alert variant="error">{error}</Alert> : null}
        {result ? (
          <div className="space-y-3 rounded-lg border border-border-subtle p-4 text-sm">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Stat label={t('Total rows', 'إجمالي الصفوف')} value={result.totalRows} />
              <Stat label={t('Orders detected', 'الطلبات المكتشفة')} value={result.ordersDetected} />
              <Stat label={t('Created', 'تم الإنشاء')} value={result.created} />
              <Stat label={t('Invalid', 'غير صالح')} value={result.invalid} />
              <Stat label={t('Duplicate', 'مكرر')} value={result.duplicate} />
            </div>
            {result.errors.length > 0 ? (
              <Button
                variant="secondary"
                onClick={() => downloadImportErrors(kind, result.errors)}
              >
                {t('Download errors', 'تنزيل الأخطاء')}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </Modal>
  );
}

function Stat({ label, value }: { label: string; value: number }): ReactElement {
  return (
    <div>
      <div className="text-xs text-text-muted">{label}</div>
      <div className="text-base font-semibold text-text-strong">{value}</div>
    </div>
  );
}
