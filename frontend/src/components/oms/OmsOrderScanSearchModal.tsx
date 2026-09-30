import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Button } from '../Button';
import { Modal } from '../Modal';

function playSuccessChime() {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(784, now); // G5
    osc1.connect(gain);
    osc1.start(now);
    osc1.stop(now + 0.1);

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1046.5, now + 0.1); // C6
    osc2.connect(gain);
    osc2.start(now + 0.1);
    osc2.stop(now + 0.25);

    gain.connect(ctx.destination);
  } catch {
    /* ignore */
  }
}

interface OmsOrderScanSearchModalProps {
  open: boolean;
  onClose: () => void;
  onScan: (scannedText: string) => void;
  isArabic?: boolean;
}

const SUPPORTED_FORMATS = [
  Html5QrcodeSupportedFormats.QR_CODE,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.ITF,
];

export function OmsOrderScanSearchModal({
  open,
  onClose,
  onScan,
  isArabic = false,
}: OmsOrderScanSearchModalProps) {
  const hostId = useId().replace(/:/g, '_') + '_order_scan_host';
  const qrInstanceRef = useRef<Html5Qrcode | null>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [manualCode, setManualCode] = useState('');
  const [detectedCode, setDetectedCode] = useState<string | null>(null);

  const stopScanner = useCallback(async () => {
    const inst = qrInstanceRef.current;
    if (!inst) return;
    try {
      if (inst.isScanning) {
        await inst.stop();
      }
    } catch {
      /* ignore */
    }
    try {
      inst.clear();
    } catch {
      /* ignore */
    }
    qrInstanceRef.current = null;
    setCameraActive(false);
  }, []);

  const handleFinishScan = useCallback(
    (rawText: string) => {
      let clean = rawText.trim();
      if (!clean) return;

      // If URL, extract last path segment
      try {
        if (clean.startsWith('http://') || clean.startsWith('https://')) {
          const url = new URL(clean);
          const segments = url.pathname.split('/').filter(Boolean);
          if (segments.length > 0) {
            clean = segments[segments.length - 1];
          }
        }
      } catch {
        /* ignore */
      }

      playSuccessChime();
      setDetectedCode(clean);
      void stopScanner();

      // Notify parent and auto-close after brief visual acknowledgement
      onScan(clean);
      setTimeout(() => {
        onClose();
      }, 400);
    },
    [onScan, onClose, stopScanner],
  );

  const startScanner = useCallback(
    async (cameraFacing: 'environment' | 'user') => {
      setCameraError(null);
      await stopScanner();

      await new Promise((r) => setTimeout(r, 100));

      const host = document.getElementById(hostId);
      if (!host) return;

      const inst = new Html5Qrcode(hostId, {
        verbose: false,
        formatsToSupport: SUPPORTED_FORMATS,
        useBarCodeDetectorIfSupported: true,
      });
      qrInstanceRef.current = inst;

      const qrbox = (viewfinderWidth: number, viewfinderHeight: number) => {
        const edge = Math.min(viewfinderWidth, viewfinderHeight);
        const w = Math.max(220, Math.floor(edge * 0.75));
        return { width: w, height: w };
      };

      try {
        await inst.start(
          { facingMode: cameraFacing },
          {
            fps: 10,
            qrbox,
            aspectRatio: 1.0,
          },
          (decodedText: string) => {
            handleFinishScan(decodedText);
          },
          () => {
            /* frame without barcode */
          },
        );
        setCameraActive(true);
      } catch (err: unknown) {
        const msg =
          err instanceof Error
            ? err.message
            : typeof err === 'string'
              ? err
              : isArabic
                ? 'تعذر الوصول إلى الكاميرا. يرجى التأكد من صلاحيات المتصفح.'
                : 'Could not access the camera. Check browser permissions.';
        setCameraError(msg);
        setCameraActive(false);
      }
    },
    [hostId, isArabic, handleFinishScan, stopScanner],
  );

  const toggleFacingMode = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    if (cameraActive) {
      void startScanner(nextMode);
    }
  };

  useEffect(() => {
    if (open) {
      setDetectedCode(null);
      setManualCode('');
      setCameraError(null);
      void startScanner(facingMode);
    } else {
      void stopScanner();
    }
    return () => {
      void stopScanner();
    };
  }, [open]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    handleFinishScan(manualCode);
  };

  const handleModalClose = () => {
    void stopScanner();
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={handleModalClose}
      title={isArabic ? 'بحث عن طلب عبر المسح (QR Code / باركود)' : 'Search Order by Scan (QR / Barcode)'}
      widthClass="max-w-lg"
      footer={
        <div className="flex w-full items-center justify-between">
          <span className="text-xs text-text-faint">
            {isArabic ? 'مسح سريع لبوالص الشحن' : 'Waybill fast scan'}
          </span>
          <Button variant="secondary" onClick={handleModalClose}>
            {isArabic ? 'إلغاء' : 'Cancel'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Instructions */}
        <p className="text-xs text-text-muted">
          {isArabic
            ? 'وجّه الكاميرا نحو QR Code أو الباركود على بوليصة الشحن للانتقال وتصفية الطلب مباشرة.'
            : 'Point camera at the waybill QR code or barcode to filter and locate the order instantly.'}
        </p>

        {/* Viewfinder Frame */}
        <div className="relative overflow-hidden rounded-2xl border-2 border-brand-500/40 bg-black/90 shadow-inner">
          <div
            id={hostId}
            className="w-full min-h-[250px] max-h-[320px] flex items-center justify-center text-white"
          />

          {/* Laser overlay */}
          {cameraActive && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="relative h-44 w-44 rounded-xl border-2 border-brand-400/80 bg-brand-500/5 shadow-[0_0_20px_rgba(59,130,246,0.3)]">
                <div className="absolute -top-1 -left-1 h-4 w-4 border-t-4 border-l-4 border-brand-400" />
                <div className="absolute -top-1 -right-1 h-4 w-4 border-t-4 border-r-4 border-brand-400" />
                <div className="absolute -bottom-1 -left-1 h-4 w-4 border-b-4 border-l-4 border-brand-400" />
                <div className="absolute -bottom-1 -right-1 h-4 w-4 border-b-4 border-r-4 border-brand-400" />
                <div className="absolute left-1 right-1 top-0 h-0.5 bg-gradient-to-r from-transparent via-brand-400 to-transparent shadow-[0_0_8px_#60a5fa] animate-pulse" />
              </div>
            </div>
          )}

          {/* Camera controls */}
          <div className="absolute top-2 right-2 flex items-center gap-1.5 z-10">
            <button
              type="button"
              onClick={toggleFacingMode}
              title={isArabic ? 'تبديل الكاميرا' : 'Flip camera'}
              className="rounded-lg bg-black/60 p-2 text-white/90 backdrop-blur-md transition hover:bg-black/80 hover:text-white"
            >
              <i className="fa-solid fa-camera-rotate text-sm" aria-hidden />
            </button>
            {!cameraActive && (
              <button
                type="button"
                onClick={() => void startScanner(facingMode)}
                title={isArabic ? 'إعادة تشغيل الكاميرا' : 'Restart camera'}
                className="rounded-lg bg-brand-600/80 p-2 text-white backdrop-blur-md transition hover:bg-brand-600"
              >
                <i className="fa-solid fa-play text-sm" aria-hidden />
              </button>
            )}
          </div>

          {/* Success overlay */}
          {detectedCode && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-emerald-950/80 backdrop-blur-xs z-20 animate-in fade-in">
              <i className="fa-solid fa-circle-check text-4xl text-emerald-400 mb-2" aria-hidden />
              <span className="font-mono text-sm font-bold text-white">{detectedCode}</span>
              <span className="mt-1 text-xs text-emerald-200">
                {isArabic ? 'تم التقاط الرمز — جاري التصفية…' : 'Code detected — filtering…'}
              </span>
            </div>
          )}

          {/* Camera error */}
          {cameraError && (
            <div className="p-6 text-center text-rose-300">
              <i className="fa-solid fa-video-slash text-2xl mb-2" aria-hidden />
              <p className="text-xs">{cameraError}</p>
              <Button
                size="sm"
                variant="secondary"
                className="mt-3 text-xs"
                onClick={() => void startScanner(facingMode)}
              >
                {isArabic ? 'إعادة المحاولة' : 'Retry camera'}
              </Button>
            </div>
          )}
        </div>

        {/* Manual Input (Barcode Gun / Keyboard) */}
        <form onSubmit={handleManualSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <i
              className="fa-solid fa-barcode absolute left-3 top-1/2 -translate-y-1/2 text-xs text-text-faint"
              aria-hidden
            />
            <input
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder={
                isArabic
                  ? 'أو أدخل رقم الطلب / استخدم قارئ الباركود…'
                  : 'Or enter order # / use barcode scanner gun…'
              }
              className="w-full rounded-xl border border-border bg-surface px-9 py-2 text-sm text-text-body placeholder:text-text-faint focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <Button type="submit" variant="primary" disabled={!manualCode.trim()} className="shrink-0">
            {isArabic ? 'بحث' : 'Search'}
          </Button>
        </form>
      </div>
    </Modal>
  );
}
