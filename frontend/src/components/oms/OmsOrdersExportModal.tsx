import { useEffect, useMemo, useState } from 'react';

import { Button } from '@ds';
import { Modal } from '../Modal';

export type OmsExportColumnOption = {
  id: string;
  labelEn: string;
  labelAr: string;
};

export type OmsExportHeaderLang = 'ar' | 'en';

type Props = {
  open: boolean;
  onClose: () => void;
  columns: OmsExportColumnOption[];
  exporting: boolean;
  onExport: (payload: { columnIds: string[]; arabicHeaders: boolean }) => void;
  isArabic?: boolean;
  title?: string;
};

export function OmsOrdersExportModal({
  open,
  onClose,
  columns,
  exporting,
  onExport,
  isArabic = false,
  title,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(columns.map((c) => c.id)));
  /** CSV column headlines language — Arabic by default. */
  const [headerLang, setHeaderLang] = useState<OmsExportHeaderLang>('ar');

  const columnKey = columns.map((c) => c.id).join(',');
  useEffect(() => {
    if (open) {
      setSelected(new Set(columns.map((c) => c.id)));
      setHeaderLang('ar');
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
        hint: 'Select the fields you want to include in the exported file.',
        headerLang: 'CSV column headers',
        arabic: 'Arabic',
        english: 'English',
        selectAll: 'Select All',
        clearAll: 'Clear All',
        selected: (n: number) => `Selected: ${n} field${n === 1 ? '' : 's'}`,
        needOne: 'Please select at least one field to export.',
        cancel: 'Cancel',
        exportCsv: 'Export CSV',
        exporting: 'Exporting...',
      };
    }
    return {
      title: title ?? 'تصدير طلبات OMS',
      hint: 'اختر الحقول التي تريد تضمينها في ملف التصدير.',
      headerLang: 'عناوين أعمدة CSV',
      arabic: 'عربي',
      english: 'إنجليزي',
      selectAll: 'تحديد الكل',
      clearAll: 'إلغاء الكل',
      selected: (n: number) => `المحدد: ${n} حقل`,
      needOne: 'يرجى اختيار حقل واحد على الأقل للتصدير.',
      cancel: 'إلغاء',
      exportCsv: 'تصدير CSV',
      exporting: 'جاري التصدير...',
    };
  }, [isArabic, title]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleExport = () => {
    if (selectedCount === 0 || exporting) return;
    const ordered = columns.filter((c) => selected.has(c.id)).map((c) => c.id);
    onExport({ columnIds: ordered, arabicHeaders });
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
            onClick={handleExport}
          >
            {exporting ? labels.exporting : labels.exportCsv}
          </Button>
        </div>
      }
    >
      <p className="text-sm text-text-muted mb-3">{labels.hint}</p>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-sm text-text-body">{labels.headerLang}</span>
        <div className="inline-flex rounded-lg border border-border-strong p-0.5">
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
        {columns.map((col) => {
          const checked = selected.has(col.id);
          const label = arabicHeaders ? col.labelAr : col.labelEn;
          return (
            <li key={col.id}>
              <label className="flex items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-surface-card-muted cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-border-strong text-brand focus:ring-brand"
                  checked={checked}
                  disabled={exporting}
                  onChange={() => toggle(col.id)}
                />
                <span className="text-sm text-text-strong">{label}</span>
              </label>
            </li>
          );
        })}
      </ul>

      {selectedCount === 0 ? (
        <p className="mt-3 text-xs text-danger-600" role="alert">
          {labels.needOne}
        </p>
      ) : null}
    </Modal>
  );
}
