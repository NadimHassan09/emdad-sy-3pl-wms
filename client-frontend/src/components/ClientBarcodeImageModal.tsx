import JsBarcode from 'jsbarcode';
import { useCallback, useLayoutEffect, useRef, useState, type ReactElement } from 'react';

import { Button, Modal } from '@ds';
import { FILTER_PRIMARY_BUTTON_CLASS } from '@ds';

type Props = {
  open: boolean;
  onClose: () => void;
  value: string;
  productName?: string;
  isArabic?: boolean;
};

function label(text: string, isArabic: boolean): string {
  if (!isArabic) return text;
  const ar: Record<string, string> = {
    Close: 'إغلاق',
    'Download PNG': 'تحميل PNG',
    'No barcode value.': 'لا توجد قيمة باركود.',
    'Could not generate a barcode image for this value.':
      'تعذر إنشاء صورة الباركود لهذه القيمة.',
  };
  return ar[text] ?? text;
}

export function ClientBarcodeImageModal({
  open,
  onClose,
  value,
  productName,
  isArabic = false,
}: Props): ReactElement {
  const t = (text: string) => label(text, isArabic);
  const titleSuffix = (productName ?? '').trim() || '—';
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  const paintBarcode = useCallback(
    (canvas: HTMLCanvasElement) => {
      const trimmed = value.trim();
      if (!trimmed) {
        setError(t('No barcode value.'));
        return;
      }
      setError(null);
      try {
        JsBarcode(canvas, trimmed, {
          format: 'CODE128',
          width: 2,
          height: 96,
          displayValue: true,
          margin: 16,
          background: '#ffffff',
          lineColor: '#0f172a',
          fontSize: 16,
        });
      } catch {
        setError(t('Could not generate a barcode image for this value.'));
      }
    },
    [isArabic, value],
  );

  const onCanvasRef = useCallback(
    (canvas: HTMLCanvasElement | null) => {
      canvasRef.current = canvas;
      if (canvas && open) paintBarcode(canvas);
    },
    [open, paintBarcode],
  );

  useLayoutEffect(() => {
    if (!open) {
      setError(null);
      return;
    }
    const canvas = canvasRef.current;
    if (canvas) paintBarcode(canvas);
  }, [open, value, paintBarcode]);

  const downloadPng = () => {
    const canvas = canvasRef.current;
    if (!canvas || error) return;
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const safe = value.replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 80) || 'barcode';
        a.download = `${safe}.png`;
        a.rel = 'noopener';
        a.click();
        URL.revokeObjectURL(url);
      },
      'image/png',
      1,
    );
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Barcode · ${titleSuffix}`}
      widthClass="max-w-lg"
      footer={
        <>
          <Button type="button" variant="danger" onClick={onClose}>
            {t('Close')}
          </Button>
          <Button
            type="button"
            variant="primary"
            className={FILTER_PRIMARY_BUTTON_CLASS}
            onClick={downloadPng}
            disabled={!!error}
          >
            {t('Download PNG')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col items-center gap-4 py-2">
        {error ? (
          <p className="text-center text-sm text-danger-600 dark:text-status-danger-fg">{error}</p>
        ) : (
          <canvas
            ref={onCanvasRef}
            className="max-w-full rounded border border-border bg-white"
          />
        )}
        {!error ? (
          <p className="text-center font-mono text-xs text-text-body">{value.trim()}</p>
        ) : null}
      </div>
    </Modal>
  );
}
