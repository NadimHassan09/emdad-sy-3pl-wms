import { useState } from 'react';

import { Button } from './Button';
import { useToast } from './ToastProvider';
import type { ExportFormat } from '../lib/download-export';

type Props = {
  /** Runs the download for the chosen format; reject with an Error to show a toast. */
  onExport: (format: ExportFormat) => Promise<void>;
  isArabic?: boolean;
  disabled?: boolean;
  /** Show the CSV button next to Excel (default true). */
  showCsv?: boolean;
};

/** Standard "Export Excel" + "Export CSV" button pair for admin list pages. */
export function ListExportButtons({ onExport, isArabic = false, disabled, showCsv = true }: Props) {
  const toast = useToast();
  const [busy, setBusy] = useState<ExportFormat | null>(null);

  const run = (format: ExportFormat) => {
    setBusy(format);
    onExport(format)
      .then(() =>
        toast.success(isArabic ? 'تم تحميل التصدير بنجاح.' : 'Export downloaded successfully.'),
      )
      .catch((err: unknown) =>
        toast.error(
          err instanceof Error
            ? err.message
            : isArabic
              ? 'فشل التصدير.'
              : 'Export failed.',
        ),
      )
      .finally(() => setBusy(null));
  };

  const label = (format: ExportFormat) => {
    if (busy === format) return isArabic ? 'جاري التصدير…' : 'Exporting…';
    if (format === 'xlsx') return isArabic ? 'تصدير إكسل' : 'Export Excel';
    return isArabic ? 'تصدير CSV' : 'Export CSV';
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="secondary"
        disabled={disabled || busy !== null}
        onClick={() => run('xlsx')}
      >
        <i className="fa-solid fa-file-excel mr-1.5 text-status-success-fg" aria-hidden />
        {label('xlsx')}
      </Button>
      {showCsv ? (
        <Button
          type="button"
          variant="secondary"
          disabled={disabled || busy !== null}
          onClick={() => run('csv')}
        >
          <i className="fa-solid fa-file-csv mr-1.5" aria-hidden />
          {label('csv')}
        </Button>
      ) : null}
    </div>
  );
}
