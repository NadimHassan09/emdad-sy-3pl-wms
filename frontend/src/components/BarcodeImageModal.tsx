import JsBarcode from 'jsbarcode';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';

import { Button } from './Button';
import { Modal } from './Modal';

interface BarcodeImageModalProps {
  open: boolean;
  onClose: () => void;
  /** Raw barcode text (e.g. CODE128). */
  value: string;
  /** Shown after “Barcode ·” in the title (e.g. product name). */
  productName?: string;
  /** Preferred title suffix; falls back to `productName`. */
  contextLabel?: string;
}

function cssVar(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

export function BarcodeImageModal({ open, onClose, value, productName, contextLabel }: BarcodeImageModalProps) {
  const titleSuffix = (contextLabel ?? productName ?? '').trim() || '—';
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  const paintBarcode = useCallback(
    (canvas: HTMLCanvasElement) => {
      const trimmed = value.trim();
      if (!trimmed) {
        setError('No barcode value.');
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
          background: cssVar('--surface-panel', '#ffffff'),
          lineColor: cssVar('--text-strong', '#0f172a'),
          fontSize: 16,
        });
      } catch {
        setError('Could not generate a barcode image for this value.');
      }
    },
    [value],
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
            Close
          </Button>
          <Button type="button" onClick={downloadPng} disabled={!!error}>
            Download PNG
          </Button>
        </>
      }
    >
      <div className="flex flex-col items-center gap-4 py-2">
        {error ? (
          <p className="text-center text-sm text-status-danger-fg">{error}</p>
        ) : (
          <canvas
            ref={onCanvasRef}
            className="max-w-full rounded border border-border bg-surface-panel"
          />
        )}
        {!error ? (
          <p className="text-center font-mono text-xs text-text-muted">{value.trim()}</p>
        ) : null}
      </div>
    </Modal>
  );
}
