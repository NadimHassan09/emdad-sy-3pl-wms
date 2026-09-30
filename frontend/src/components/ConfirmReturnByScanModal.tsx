import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { OmsReturnsApi, type OmsConfirmReturnByScanResponse } from '../api/oms';
import { Button } from './Button';
import { Modal } from './Modal';

// Audio feedback using Web Audio API (zero external assets needed)
function playFeedbackSound(type: 'success' | 'warning' | 'error') {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    if (type === 'success') {
      // Pleasant high-pitch double chime
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.28);

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(880, now); // A5
      osc1.connect(gain);
      osc1.start(now);
      osc1.stop(now + 0.12);

      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1318.51, now + 0.12); // E6
      osc2.connect(gain);
      osc2.start(now + 0.12);
      osc2.stop(now + 0.28);

      gain.connect(ctx.destination);
    } else if (type === 'warning') {
      // Warm neutral double tone
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.25);
    } else {
      // Low buzzer tone
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, now); // A3
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.3);
    }
  } catch {
    // AudioContext blocked or not supported
  }
}

export interface ScannedItemLog {
  id: string;
  time: string;
  rawCode: string;
  orderNumber?: string;
  returnNumber?: string;
  clientName?: string;
  action?: 'confirmed' | 'already_completed' | 'created_and_confirmed' | 'failed';
  message: string;
  status: 'success' | 'warning' | 'error';
}

interface ConfirmReturnByScanModalProps {
  open: boolean;
  onClose: () => void;
  isArabic?: boolean;
  onRefreshNeeded?: () => void;
}

const SUPPORTED_SCAN_FORMATS = [
  Html5QrcodeSupportedFormats.QR_CODE,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.ITF,
];

export function ConfirmReturnByScanModal({
  open,
  onClose,
  isArabic = false,
  onRefreshNeeded,
}: ConfirmReturnByScanModalProps) {
  const hostId = useId().replace(/:/g, '_') + '_scan_host';
  const qrInstanceRef = useRef<Html5Qrcode | null>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [manualCode, setManualCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [logs, setLogs] = useState<ScannedItemLog[]>([]);
  const [hasNewConfirmed, setHasNewConfirmed] = useState(false);

  // Debounce ref to prevent duplicate triggers on the same code within 3 seconds
  const lastScannedRef = useRef<{ code: string; timestamp: number }>({ code: '', timestamp: 0 });
  const isProcessingRef = useRef(false);

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

  const handleProcessCode = useCallback(
    async (codeToProcess: string) => {
      const code = codeToProcess.trim();
      if (!code) return;

      if (isProcessingRef.current) return;
      isProcessingRef.current = true;
      setIsSubmitting(true);

      const timeStr = new Date().toLocaleTimeString(isArabic ? 'ar-SA' : 'en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

      try {
        const res: OmsConfirmReturnByScanResponse = await OmsReturnsApi.confirmReturnByScan(code);

        if (res.action === 'already_completed') {
          playFeedbackSound('warning');
          setLogs((prev) => [
            {
              id: `${Date.now()}-${Math.random()}`,
              time: timeStr,
              rawCode: code,
              orderNumber: res.orderNumber,
              returnNumber: res.returnNumber,
              clientName: res.clientName,
              action: res.action,
              message: res.message || (isArabic ? 'المرتجع مكتمل مسبقاً.' : 'Already completed.'),
              status: 'warning',
            },
            ...prev,
          ]);
        } else {
          playFeedbackSound('success');
          setHasNewConfirmed(true);
          setLogs((prev) => [
            {
              id: `${Date.now()}-${Math.random()}`,
              time: timeStr,
              rawCode: code,
              orderNumber: res.orderNumber,
              returnNumber: res.returnNumber,
              clientName: res.clientName,
              action: res.action,
              message: res.message || (isArabic ? 'تم استلام وتأكيد المرتجع بنجاح.' : 'Confirmed & restocked.'),
              status: 'success',
            },
            ...prev,
          ]);
        }
      } catch (err: unknown) {
        playFeedbackSound('error');
        const errMessage =
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          (err instanceof Error ? err.message : String(err)) ||
          (isArabic ? 'فشل التحقق من الرمز أو الطلب.' : 'Failed to process code.');

        setLogs((prev) => [
          {
            id: `${Date.now()}-${Math.random()}`,
            time: timeStr,
            rawCode: code,
            action: 'failed',
            message: errMessage,
            status: 'error',
          },
          ...prev,
        ]);
      } finally {
        setIsSubmitting(false);
        // Cooldown before allowing next scan of the same code
        setTimeout(() => {
          isProcessingRef.current = false;
        }, 800);
      }
    },
    [isArabic],
  );

  // Continuous Camera Scanner Initializer
  const startScanner = useCallback(
    async (cameraFacing: 'environment' | 'user') => {
      setCameraError(null);
      await stopScanner();

      // Ensure element exists in DOM
      await new Promise((r) => setTimeout(r, 100));

      const host = document.getElementById(hostId);
      if (!host) return;

      const inst = new Html5Qrcode(hostId, {
        verbose: false,
        formatsToSupport: SUPPORTED_SCAN_FORMATS,
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
            const clean = decodedText.trim();
            if (!clean) return;

            const now = Date.now();
            // Debounce: don't re-trigger same code within 3 seconds
            if (
              lastScannedRef.current.code === clean &&
              now - lastScannedRef.current.timestamp < 3000
            ) {
              return;
            }

            lastScannedRef.current = { code: clean, timestamp: now };
            void handleProcessCode(clean);
          },
          () => {
            /* scan frame without code, ignore */
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
                ? 'تعذر الوصول إلى الكاميرا. يرجى التأكد من منح الإذن للمتصفح.'
                : 'Could not access the camera. Check browser permissions.';
        setCameraError(msg);
        setCameraActive(false);
      }
    },
    [hostId, isArabic, handleProcessCode, stopScanner],
  );

  // Toggle camera direction (front / rear)
  const toggleFacingMode = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    if (cameraActive) {
      void startScanner(nextMode);
    }
  };

  useEffect(() => {
    if (open) {
      setLogs([]);
      setHasNewConfirmed(false);
      setManualCode('');
      setCameraError(null);
      void startScanner(facingMode);
    } else {
      void stopScanner();
      if (hasNewConfirmed) {
        onRefreshNeeded?.();
      }
    }
    return () => {
      void stopScanner();
    };
  }, [open]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    const code = manualCode.trim();
    setManualCode('');
    void handleProcessCode(code);
  };

  const handleModalClose = () => {
    void stopScanner();
    if (hasNewConfirmed) {
      onRefreshNeeded?.();
    }
    onClose();
  };

  // Stats
  const successCount = logs.filter((l) => l.status === 'success').length;
  const warningCount = logs.filter((l) => l.status === 'warning').length;
  const errorCount = logs.filter((l) => l.status === 'error').length;

  return (
    <Modal
      open={open}
      onClose={handleModalClose}
      title={isArabic ? 'تأكيد واستلام المرتجع عبر المسح (QR Code)' : 'Confirm Return by Scan (QR Code)'}
      widthClass="max-w-2xl"
      footer={
        <div className="flex w-full items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-text-faint">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              {isArabic ? 'وضع المسح المستمر نشط' : 'Continuous scan active'}
            </span>
          </div>
          <Button variant="primary" onClick={handleModalClose}>
            {isArabic ? 'إنهاء وإغلاق' : 'Done & Close'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Helper info banner */}
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-3 text-xs text-emerald-900 dark:border-emerald-800/40 dark:bg-emerald-950/30 dark:text-emerald-200">
          <div className="flex items-start gap-2">
            <i className="fa-solid fa-circle-info mt-0.5 text-emerald-600 dark:text-emerald-400" aria-hidden />
            <div>
              <p className="font-semibold">
                {isArabic
                  ? 'وجّه الكاميرا نحو QR Code أو الباركود الموجود على بوليصة شحن الطلب'
                  : 'Point camera at the QR code or barcode on the shipping waybill'}
              </p>
              <p className="mt-0.5 text-text-muted">
                {isArabic
                  ? 'ستظل الكاميرا تعمل تلقائياً لمسح الطرود تباعاً وإعادتها فورياً للمستودع دون إغلاق هذه النافذة.'
                  : 'Camera stays running so you can scan parcel after parcel rapidly without closing.'}
              </p>
            </div>
          </div>
        </div>

        {/* Camera Viewport & Overlay */}
        <div className="relative overflow-hidden rounded-2xl border-2 border-emerald-500/40 bg-black/90 shadow-inner">
          <div
            id={hostId}
            className="w-full min-h-[260px] max-h-[340px] flex items-center justify-center text-white"
          />

          {/* Custom Laser Frame Overlay when active */}
          {cameraActive && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="relative h-48 w-48 rounded-xl border-2 border-emerald-400/80 bg-emerald-500/5 shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                {/* Corner accents */}
                <div className="absolute -top-1 -left-1 h-4 w-4 border-t-4 border-l-4 border-emerald-400" />
                <div className="absolute -top-1 -right-1 h-4 w-4 border-t-4 border-r-4 border-emerald-400" />
                <div className="absolute -bottom-1 -left-1 h-4 w-4 border-b-4 border-l-4 border-emerald-400" />
                <div className="absolute -bottom-1 -right-1 h-4 w-4 border-b-4 border-r-4 border-emerald-400" />
                {/* Scanning laser animation */}
                <div className="absolute left-1 right-1 top-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_8px_#34d399] animate-pulse" />
              </div>
            </div>
          )}

          {/* Camera controls toolbar overlay */}
          <div className="absolute top-2 right-2 flex items-center gap-1.5 z-10">
            <button
              type="button"
              onClick={toggleFacingMode}
              title={isArabic ? 'تبديل الكاميرا (أمامية / خلفية)' : 'Flip camera'}
              className="rounded-lg bg-black/60 p-2 text-white/90 backdrop-blur-md transition hover:bg-black/80 hover:text-white"
            >
              <i className="fa-solid fa-camera-rotate text-sm" aria-hidden />
            </button>
            {!cameraActive && (
              <button
                type="button"
                onClick={() => void startScanner(facingMode)}
                title={isArabic ? 'إعادة تشغيل الكاميرا' : 'Restart camera'}
                className="rounded-lg bg-emerald-600/80 p-2 text-white backdrop-blur-md transition hover:bg-emerald-600"
              >
                <i className="fa-solid fa-play text-sm" aria-hidden />
              </button>
            )}
          </div>

          {/* In-flight processing spinner overlay */}
          {isSubmitting && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 backdrop-blur-xs z-20">
              <i className="fa-solid fa-spinner fa-spin text-3xl text-emerald-400" aria-hidden />
              <span className="mt-2 text-xs font-semibold text-white">
                {isArabic ? 'جاري التحقق والاستلام…' : 'Processing return…'}
              </span>
            </div>
          )}

          {/* Camera error state */}
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

        {/* Manual Barcode / Gun Scanner Input */}
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
                  ? 'أو أدخل الكود يدوياً / استخدم قارئ الباركود (Barcode Gun)…'
                  : 'Or enter code manually / use USB barcode scanner…'
              }
              disabled={isSubmitting}
              className="w-full rounded-xl border border-border bg-surface px-9 py-2 text-sm text-text-body placeholder:text-text-faint focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <Button
            type="submit"
            variant="primary"
            disabled={!manualCode.trim() || isSubmitting}
            className="shrink-0"
          >
            {isArabic ? 'تأكيد' : 'Confirm'}
          </Button>
        </form>

        {/* Session Stats Bar */}
        <div className="flex items-center justify-between rounded-xl border border-border bg-surface-raised px-4 py-2 text-xs">
          <span className="font-semibold text-text-body">
            {isArabic ? 'سجل عمليات الجلسة الحالية:' : 'Current session activity:'}
          </span>
          <div className="flex items-center gap-3 font-medium">
            <span className="text-emerald-700 dark:text-emerald-400">
              ✓ {isArabic ? 'ناجح' : 'Success'}: {successCount}
            </span>
            <span className="text-amber-700 dark:text-amber-400">
              ⚡ {isArabic ? 'مكتمل مسبقاً' : 'Already done'}: {warningCount}
            </span>
            {errorCount > 0 && (
              <span className="text-rose-700 dark:text-rose-400">
                ✕ {isArabic ? 'فشل' : 'Failed'}: {errorCount}
              </span>
            )}
          </div>
        </div>

        {/* Activity Log List */}
        <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
          {logs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border py-6 text-center text-xs text-text-faint">
              <i className="fa-solid fa-barcode text-xl mb-1 opacity-50 block" aria-hidden />
              {isArabic
                ? 'لم يتم مسح أي طرد بعد. ابدأ بتوجيه الكاميرا نحو باركود بوليصة الشحن.'
                : 'No parcels scanned yet. Start scanning waybills to see instant results.'}
            </div>
          ) : (
            logs.map((item) => (
              <div
                key={item.id}
                className={`flex items-center justify-between gap-3 rounded-xl border p-2.5 text-xs transition animate-in fade-in duration-200 ${
                  item.status === 'success'
                    ? 'border-emerald-200 bg-emerald-50/70 text-emerald-950 dark:border-emerald-800/40 dark:bg-emerald-950/20 dark:text-emerald-100'
                    : item.status === 'warning'
                      ? 'border-amber-200 bg-amber-50/70 text-amber-950 dark:border-amber-800/40 dark:bg-amber-950/20 dark:text-amber-100'
                      : 'border-rose-200 bg-rose-50/70 text-rose-950 dark:border-rose-800/40 dark:bg-rose-950/20 dark:text-rose-100'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                      item.status === 'success'
                        ? 'bg-emerald-600 text-white'
                        : item.status === 'warning'
                          ? 'bg-amber-600 text-white'
                          : 'bg-rose-600 text-white'
                    }`}
                  >
                    {item.status === 'success' ? '✓' : item.status === 'warning' ? '⚡' : '✕'}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <strong className="font-mono text-xs">{item.orderNumber || item.rawCode}</strong>
                      {item.returnNumber && (
                        <span className="text-[11px] text-text-faint">({item.returnNumber})</span>
                      )}
                      {item.clientName && (
                        <span className="rounded bg-black/5 px-1 py-0.2 text-[10px] font-medium text-text-muted dark:bg-white/10">
                          {item.clientName}
                        </span>
                      )}
                    </div>
                    <p className="truncate text-[11px] text-text-muted">{item.message}</p>
                  </div>
                </div>
                <span className="shrink-0 text-[10px] font-mono text-text-faint">{item.time}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </Modal>
  );
}
