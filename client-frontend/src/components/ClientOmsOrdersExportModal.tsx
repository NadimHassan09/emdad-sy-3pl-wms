import { useEffect, useMemo, useState, type ReactElement } from 'react';

import { Alert, Button, Modal } from '@ds';

export type ClientOmsExportColumnOption = {
  id: string;
  labelEn: string;
  labelAr: string;
};

export type ClientOmsExportHeaderLang = 'ar' | 'en';
export type ExportFileFormat = 'xlsx' | 'csv';

type Props = {
  open: boolean;
  onClose: () => void;
  columns: ClientOmsExportColumnOption[];
  exporting: boolean;
  onExport: (payload: { columnIds: string[]; arabicHeaders: boolean; format: ExportFileFormat }) => void;
  isArabic?: boolean;
  errorMessage?: string | null;
  /** Optional override; defaults to OMS title. */
  title?: string;
};

export function ClientOmsOrdersExportModal({
  open,
  onClose,
  columns,
  exporting,
  onExport,
  isArabic = false,
  errorMessage = null,
  title,
}: Props): ReactElement {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(columns.map((c) => c.id)));
  const [format, setFormat] = useState<ExportFileFormat>('xlsx');
  /** Column headlines language — Arabic by default. */
  const [headerLang, setHeaderLang] = useState<ClientOmsExportHeaderLang>('ar');

  const columnKey = columns.map((c) => c.id).join(',');
  useEffect(() => {
    if (open) {
      setSelected(new Set(columns.map((c) => c.id)));
      setHeaderLang('ar');
      setFormat('xlsx');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, columnKey]);

  const selectedCount = selected.size;
  const allSelected = columns.length > 0 && selectedCount === columns.length;
  const arabicHeaders = headerLang === 'ar';

  const labels = useMemo(() => {
    if (!isArabic) {
      return {
        title: title ?? 'Export OMS Orders',
        hint: 'Select the fields and file format you want to export.',
        formatLabel: 'File format',
        excel: 'Excel (.xlsx)',
        csv: 'CSV (.csv)',
        headerLang: 'Column headers language',
        arabic: 'Arabic',
        english: 'English',
        selectAll: 'Select All',
        clearAll: 'Clear All',
        selected: (n: number) => `Selected: ${n} field${n === 1 ? '' : 's'}`,
        needOne: 'Please select at least one field to export.',
        cancel: 'Cancel',
        exportBtn: format === 'xlsx' ? 'Export Excel' : 'Export CSV',
        exporting: 'Exporting...',
      };
    }
    return {
      title: title ?? 'تصدير الطلبات الإلكترونية',
      hint: 'اختر الحقول وصيغة الملف التي تريد تصديرها.',
      formatLabel: 'صيغة الملف',
      excel: 'إكسل (.xlsx)',
      csv: 'CSV (.csv)',
      headerLang: 'لغة عناوين الأعمدة',
      arabic: 'عربي',
      english: 'إنجليزي',
      selectAll: 'تحديد الكل',
      clearAll: 'إلغاء الكل',
      selected: (n: number) => `المحدد: ${n} حقل`,
      needOne: 'يرجى اختيار حقل واحد على الأقل للتصدير.',
      cancel: 'إلغاء',
      exportBtn: format === 'xlsx' ? 'تصدير إكسل' : 'تصدير CSV',
      exporting: 'جاري التصدير...',
    };
  }, [isArabic, title, format]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!exporting) onClose();
      }}
      title={labels.title}
      widthClass="max-w-lg"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="secondary" size="md" disabled={exporting} onClick={onClose}>
            {labels.cancel}
          </Button>
          <Button
            type="button"
            variant="primary"
            size="md"
            loading={exporting}
            disabled={selectedCount === 0 || exporting}
            onClick={() => {
              if (selectedCount === 0 || exporting) return;
              onExport({
                columnIds: columns.filter((c) => selected.has(c.id)).map((c) => c.id),
                arabicHeaders,
                format,
              });
            }}
          >
            {exporting ? labels.exporting : labels.exportBtn}
          </Button>
        </div>
      }
    >
      <p className="text-sm text-text-muted mb-3">{labels.hint}</p>

      {errorMessage ? (
        <Alert variant="error" title={errorMessage} className="mb-3" />
      ) : null}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 p-2.5 rounded-lg border border-border-default bg-surface-muted">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-text-body">{labels.formatLabel}</span>
          <div className="inline-flex rounded-lg border border-border-strong p-0.5 bg-surface-base">
            <Button
              type="button"
              variant={format === 'xlsx' ? 'primary' : 'ghost'}
              size="sm"
              disabled={exporting}
              onClick={() => setFormat('xlsx')}
            >
              {labels.excel}
            </Button>
            <Button
              type="button"
              variant={format === 'csv' ? 'primary' : 'ghost'}
              size="sm"
              disabled={exporting}
              onClick={() => setFormat('csv')}
            >
              {labels.csv}
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-text-body">{labels.headerLang}</span>
          <div className="inline-flex rounded-lg border border-border-strong p-0.5 bg-surface-base">
            <Button
              type="button"
              variant={headerLang === 'ar' ? 'primary' : 'ghost'}
              size="sm"
              disabled={exporting}
              onClick={() => setHeaderLang('ar')}
            >
              {labels.arabic}
            </Button>
            <Button
              type="button"
              variant={headerLang === 'en' ? 'primary' : 'ghost'}
              size="sm"
              disabled={exporting}
              onClick={() => setHeaderLang('en')}
            >
              {labels.english}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <Button
          type="button"
          variant="subtle"
          size="sm"
          disabled={exporting || allSelected}
          onClick={() => setSelected(new Set(columns.map((c) => c.id)))}
        >
          {labels.selectAll}
        </Button>
        <Button
          type="button"
          variant="subtle"
          size="sm"
          disabled={exporting || selectedCount === 0}
          onClick={() => setSelected(new Set())}
        >
          {labels.clearAll}
        </Button>
        <span className="text-xs text-text-muted ms-auto">{labels.selected(selectedCount)}</span>
      </div>

      <ul className="space-y-1.5 max-h-72">
        {columns.map((col) => (
          <li key={col.id}>
            <label className="flex items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-surface-hover cursor-pointer">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-border-strong text-brand focus:ring-brand"
                checked={selected.has(col.id)}
                disabled={exporting}
                onChange={() => toggle(col.id)}
              />
              <span className="text-sm text-text-strong">
                {arabicHeaders ? col.labelAr : col.labelEn}
              </span>
            </label>
          </li>
        ))}
      </ul>

      {selectedCount === 0 ? (
        <p className="mt-3 text-xs text-danger-600" role="alert">
          {labels.needOne}
        </p>
      ) : null}
    </Modal>
  );
}
