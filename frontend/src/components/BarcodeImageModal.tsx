import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';
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
  const [format, setFormat] = useState<'barcode' | 'qr'>('barcode');

  const paintBarcode = useCallback(
    (canvas: HTMLCanvasElement) => {
      const trimmed = value.trim();
      if (!trimmed) {
        setError('No barcode value.');
        return;
      }
      setError(null);
      try {
        if (format === 'qr') {
          void QRCode.toCanvas(canvas, trimmed, {
            width: 280,
            margin: 2,
            color: { dark: '#0f172a', light: '#ffffff' },
          });
          return;
        }
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
        setError('Could not generate an image for this value.');
      }
    },
    [format, value],
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
  }, [open, value, format, paintBarcode]);

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
          <Button
            type="button"
            variant="secondary"
            disabled={!!error}
            onClick={() => {
              const canvas = canvasRef.current;
              if (!canvas) return;
              const win = window.open('', '_blank', 'noopener,noreferrer,width=480,height=640');
              if (!win) return;
              win.document.write(`<img src="${canvas.toDataURL('image/png')}" alt="" style="width:280px;height:auto" />`);
              win.document.close();
              win.focus();
              win.print();
            }}
          >
            Print
          </Button>
          <Button type="button" onClick={downloadPng} disabled={!!error}>
            Download PNG
          </Button>
        </>
      }
    >
      <div className="flex flex-col items-center gap-4 py-2">
        <div className="flex gap-2">
          <Button type="button" variant={format === 'barcode' ? 'brand' : 'secondary'} onClick={() => setFormat('barcode')}>
            Barcode
          </Button>
          <Button type="button" variant={format === 'qr' ? 'brand' : 'secondary'} onClick={() => setFormat('qr')}>
            QR Code
          </Button>
        </div>
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
