import { useMutation, useQuery } from '@tanstack/react-query';
import { useRef, useState, type ChangeEvent } from 'react';

import { Button } from '@ds';

import { CompaniesApi } from '../../api/companies';
import { InboundApi } from '../../api/inbound';
import { Combobox } from '../Combobox';
import { Modal } from '../Modal';
import { useToast } from '../ToastProvider';
import { useWmsTranslation } from '../../lib/ui-i18n';
import { QK } from '../../constants/query-keys';

type Props = {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
};

type ImportResult = Record<string, any>;

type ClientSummary = {
  created?: number;
  invalid?: number;
  duplicate?: number;
  createdOrderNumbers?: string[];
  errors?: Array<{ rowNumber: number; orderNumber: string | null; error: string; field?: string | null }>;
};

function errorsToCsv(
  errors: Array<{ rowNumber: number; externalReference?: string | null; orderNumber?: string | null; reason?: string; error?: string }>,
): string {
  const lines = ['row_number,external_reference,reason'];
  for (const e of errors) {
    const ref = (e.externalReference ?? e.orderNumber ?? '').replace(/"/g, '""');
    const reason = (e.reason ?? e.error ?? '').replace(/"/g, '""');
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
  const [companyId, setCompanyId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<(ImportResult & ClientSummary) | null>(null);

  const companiesQuery = useQuery({
    queryKey: QK.companies,
    queryFn: () => CompaniesApi.list(),
    staleTime: 10 * 60_000,
    enabled: open,
  });

  const companyOptions =
    companiesQuery.data?.map((c) => ({ value: c.id, label: c.name })) ?? [];

  const reset = () => {
    setCompanyId('');
    setFile(null);
    setResult(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const close = () => {
    if (importMut.isPending) return;
    reset();
    onClose();
  };

  const importMut = useMutation({
    mutationFn: (f: File) => InboundApi.importOrders(f, companyId),
    onSuccess: (data) => {
      setResult(data);
      const imported = data.imported ?? data.created ?? 0;
      const failed = data.failed ?? data.invalid ?? 0;
      toast.success(
        t([
          `Imported ${imported} order(s). Failed: ${failed}.`,
          `تم استيراد ${imported} طلب/طلبات. فشل: ${failed}.`,
        ]),
      );
      onImported();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const next = e.target.files?.[0] ?? null;
    setFile(next);
    setResult(null);
  };

  const busy = importMut.isPending;

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
            variant="primary"
            disabled={!file || !companyId || busy}
            loading={importMut.isPending}
            onClick={() => file && importMut.mutate(file)}
          >
            {t(['Import', 'استيراد'])}
          </Button>
        </div>
      }
    >
      <div className="space-y-4 text-sm text-text-body">
        <p>
          {t([
            'Pick a client, download the client CSV/Excel template, then upload once. Same validation as the client portal (complete rows only).',
            'اختر عميلًا، نزّل قالب العميل CSV/Excel، ثم ارفع الملف مرة واحدة. نفس قواعد التحقق في بوابة العميل (صفوف مكتملة فقط).',
          ])}
        </p>

        <div className="min-w-0">
          <Combobox
            label={t(['Client company', 'شركة العميل'])}
            value={companyId}
            onChange={setCompanyId}
            options={companyOptions}
            placeholder={t(['Select company…', 'اختر الشركة…'])}
            disabled={busy}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={!companyId || busy}
            onClick={() => {
              void InboundApi.downloadImportTemplate().catch((err: Error) => toast.error(err.message));
            }}
          >
            {t(['Download client template', 'تنزيل قالب العميل'])}
          </Button>
        </div>

        <div>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            disabled={!companyId || busy}
            onChange={onFile}
          />
        </div>

        {result ? (
          <div className="rounded-lg border border-border-subtle bg-surface-card-muted/50 p-3 space-y-2">
            <p>
              {t(['Created', 'تم الإنشاء'])}: {result.imported ?? result.created ?? 0} ·{' '}
              {t(['Failed', 'فشل'])}: {result.failed ?? result.invalid ?? 0} ·{' '}
              {t(['Duplicates', 'مكررات'])}: {result.skippedDuplicates ?? result.duplicate ?? 0}
            </p>
            {(result.errors?.length ?? 0) > 0 ? (
              <Button
                variant="subtle"
                size="sm"
                onClick={() =>
                  downloadText(
                    'inbound-import-errors.csv',
                    errorsToCsv(result.errors as never),
                  )
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
