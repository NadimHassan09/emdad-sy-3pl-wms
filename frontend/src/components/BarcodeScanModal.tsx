import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { type ChangeEvent, useCallback, useEffect, useId, useRef, useState } from 'react';

import { Button } from './Button';
import { Modal } from './Modal';

const BARCODE_FORMATS = [
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.ITF,
];

const html5Config = {
  verbose: false as const,
  formatsToSupport: BARCODE_FORMATS,
  /** Native BarcodeDetector (Chrome) reads 1D codes well in busy photos. */
  useBarCodeDetectorIfSupported: true,
};

/** Wider format list for still-image decode (live snapshot / file). */
const fileScanHtml5Config = {
  verbose: false as const,
  useBarCodeDetectorIfSupported: true,
};

interface BarcodeScanModalProps {
  open: boolean;
  onClose: () => void;
  onScan: (text: string) => void;
  onCameraError?: (message: string) => void;
}

async function stopInstance(inst: Html5Qrcode | null) {
  if (!inst) return;
  try {
    await inst.stop();
  } catch {
    /* already stopped */
  }
  try {
    inst.clear();
  } catch {
    /* ignore */
  }
}

/** Decode barcode from a still image (whole frame — works with background around the label). */
async function scanBarcodeFromImageFile(
  elementId: string,
  file: File,
  config: typeof html5Config | typeof fileScanHtml5Config = fileScanHtml5Config,
): Promise<string> {
  const inst = new Html5Qrcode(elementId, config);
  try {
    return await inst.scanFile(file, false);
  } finally {
    try {
      inst.clear();
    } catch {
      /* ignore */
    }
  }
}

const NATIVE_BARCODE_FORMATS = [
  'code_128',
  'code_39',
  'code_93',
  'codabar',
  'ean_13',
  'ean_8',
  'itf',
  'upc_a',
  'upc_e',
  'qr_code',
  'data_matrix',
  'pdf417',
];

async function tryNativeBarcodeDetect(source: HTMLCanvasElement): Promise<string | null> {
  type DetectorCls = new (opts?: { formats?: string[] }) => {
    detect: (s: HTMLCanvasElement) => Promise<Array<{ rawValue?: string }>>;
  };
  const BD = (globalThis as unknown as { BarcodeDetector?: DetectorCls }).BarcodeDetector;
  if (!BD) return null;
  try {
    const detector = new BD({ formats: NATIVE_BARCODE_FORMATS });
    const codes = await detector.detect(source);
    const hit = codes.find((c) => c.rawValue?.trim());
    return hit?.rawValue?.trim() ?? null;
  } catch {
    return null;
  }
}

/** Max edge length for decoders; huge camera frames often decode worse than a sharp downscale. */
const MAX_DECODE_EDGE = 1920;

function canvasFromVideoFrame(video: HTMLVideoElement): HTMLCanvasElement {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  let tw = vw;
  let th = vh;
  const maxEdge = Math.max(vw, vh);
  if (maxEdge > MAX_DECODE_EDGE) {
    const s = MAX_DECODE_EDGE / maxEdge;
    tw = Math.round(vw * s);
    th = Math.round(vh * s);
  }
  const minEdge = Math.min(tw, th);
  if (minEdge > 0 && minEdge < 360) {
    const s = Math.min(2.5, 360 / minEdge);
    tw = Math.round(tw * s);
    th = Math.round(th * s);
  }
  const canvas = document.createElement('canvas');
  canvas.width = tw;
  canvas.height = th;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unsupported');
  ctx.imageSmoothingEnabled = minEdge < 360;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(video, 0, 0, vw, vh, 0, 0, tw, th);
  return canvas;
}

async function canvasToPngFile(canvas: HTMLCanvasElement, name: string): Promise<File> {
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), 'image/png'),
  );
  if (!blob) throw new Error('No image');
  return new File([blob], name, { type: 'image/png' });
}

async function decodeCanvasWithHtml5(elementId: string, canvas: HTMLCanvasElement): Promise<string> {
  const file = await canvasToPngFile(canvas, 'frame.png');
  try {
    return await scanBarcodeFromImageFile(elementId, file);
  } catch {
    const jpegBlob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.98),
    );
    if (!jpegBlob) throw new Error('No image');
    const jf = new File([jpegBlob], 'frame.jpg', { type: 'image/jpeg' });
    return await scanBarcodeFromImageFile(elementId, jf);
  }
}

export function BarcodeScanModal({ open, onClose, onScan, onCameraError }: BarcodeScanModalProps) {
  const photoHostId = useId().replace(/:/g, '');
  const liveHostId = useId().replace(/:/g, '');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const liveRef = useRef<Html5Qrcode | null>(null);
  const handledRef = useRef(false);
  const onScanRef = useRef(onScan);
  const onCloseRef = useRef(onClose);
  const onCameraErrorRef = useRef(onCameraError);

  const [hint, setHint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** `null` = choose method; `'live'` = streaming camera */
  const [liveMode, setLiveMode] = useState(false);

  onScanRef.current = onScan;
  onCloseRef.current = onClose;
  onCameraErrorRef.current = onCameraError;

  const finishSuccess = useCallback((text: string) => {
    const trimmed = text.trim();
    if (trimmed) onScanRef.current(trimmed);
    onCloseRef.current();
  }, []);

  const releaseLive = useCallback(async () => {
    const inst = liveRef.current;
    liveRef.current = null;
    await stopInstance(inst);
  }, []);

  const handleUserClose = useCallback(() => {
    void releaseLive();
    setHint(null);
    setLiveMode(false);
    setBusy(false);
    handledRef.current = false;
    onCloseRef.current();
  }, [releaseLive]);

  useEffect(() => {
    if (!open || !liveMode) {
      void releaseLive();
      handledRef.current = false;
      return;
    }

    handledRef.current = false;
    setHint(null);

    let cancelled = false;
    const inst = new Html5Qrcode(liveHostId, html5Config);
    liveRef.current = inst;

    /** Live preview only — user taps “Scan now” to decode the current frame. */
    const noopDecode = () => {};

    /** Scan most of the frame so a small barcode in a busy scene is still sampled. */
    const qrbox = (viewfinderWidth: number, viewfinderHeight: number) => {
      const w = Math.max(200, Math.floor(viewfinderWidth * 0.92));
      const h = Math.max(120, Math.floor(viewfinderHeight * 0.88));
      return { width: w, height: h };
    };

    const startWith = async (constraints: MediaTrackConstraints) => {
      await inst.start(
        constraints,
        {
          fps: 4,
          qrbox,
        },
        noopDecode,
        () => {},
      );
    };

    const run = async () => {
      try {
        await startWith({ facingMode: 'environment' });
      } catch {
        if (cancelled) return;
        try {
          await startWith({ facingMode: 'user' });
        } catch (e) {
          const msg =
            e instanceof Error
              ? e.message
              : typeof e === 'string'
                ? e
                : 'Could not start the camera.';
          setHint(msg);
          onCameraErrorRef.current?.(msg);
          liveRef.current = null;
          await stopInstance(inst);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
      void releaseLive();
      handledRef.current = false;
    };
  }, [open, liveMode, liveHostId, releaseLive]);

  useEffect(() => {
    if (!open) {
      setLiveMode(false);
      setHint(null);
      setBusy(false);
      handledRef.current = false;
    }
  }, [open]);

  const scanLiveCameraFrame = useCallback(async () => {
    const host = document.getElementById(liveHostId);
    const video = host?.querySelector('video') as HTMLVideoElement | null;
    if (!video || video.readyState < 2 || video.videoWidth < 8) {
      setHint('Camera is still starting — wait a moment, then tap Scan now again.');
      return;
    }
    setBusy(true);
    setHint(null);
    try {
      const canvas = canvasFromVideoFrame(video);

      const native = await tryNativeBarcodeDetect(canvas);
      if (native) {
        finishSuccess(native);
        return;
      }

      const text = await decodeCanvasWithHtml5(photoHostId, canvas);
      finishSuccess(text);
    } catch {
      setHint(
        'No barcode read. Move closer so bars are sharp, add light, avoid glare, then tap Scan now. You can also use Take photo for a still capture.',
      );
    } finally {
      setBusy(false);
    }
  }, [liveHostId, photoHostId, finishSuccess]);

  const onPhotoPicked = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !open) return;

    setBusy(true);
    setHint(null);
    try {
      const text = await scanBarcodeFromImageFile(photoHostId, file);
      finishSuccess(text);
    } catch {
      setHint(
        'No barcode was read from this photo. Try again with better light, hold steadier, or move closer so the code is sharp.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleUserClose}
      title="Scan barcode"
      widthClass="max-w-lg"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={handleUserClose} disabled={busy}>
            Cancel
          </Button>
        </>
      }
    >
      <p className="mb-3 text-sm text-slate-600">
        <strong>Take a photo</strong> of the label (surrounding scene is fine). Or open <strong>live camera</strong>,
        aim at the barcode, then tap <strong>Scan now</strong> to read the current frame.
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={onPhotoPicked}
        disabled={busy}
      />

      {/* Off-screen host for scanFile(); library expects a real-sized element. */}
      <div className="relative">
        <div
          id={photoHostId}
          className="pointer-events-none absolute left-0 top-0 h-[280px] w-[400px] -translate-x-[120%] overflow-hidden opacity-0"
          aria-hidden
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={busy}
          onClick={() => fileInputRef.current?.click()}
        >
          Take photo of barcode
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={busy}
          onClick={() => {
            setHint(null);
            setLiveMode((v) => !v);
          }}
        >
          {liveMode ? 'Stop live camera' : 'Use live camera'}
        </Button>
      </div>

      {liveMode ? (
        <div className="mt-4 space-y-3">
          <div
            id={liveHostId}
            className="mx-auto min-h-[260px] w-full max-w-md overflow-hidden rounded-lg bg-slate-950"
          />
          <div className="flex justify-center">
            <Button type="button" onClick={() => void scanLiveCameraFrame()} disabled={busy} loading={busy}>
              Scan now
            </Button>
          </div>
        </div>
      ) : null}

      {busy ? (
        <p className="mt-3 text-center text-sm text-slate-600">
          {liveMode ? 'Reading frame…' : 'Reading image…'}
        </p>
      ) : null}
      {hint ? <p className="mt-3 text-center text-sm text-rose-600">{hint}</p> : null}
    </Modal>
  );
}
