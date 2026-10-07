import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode'
import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { Barcode, CheckCircle2, Play, SwitchCamera, VideoOff } from 'lucide-react'
import { Button } from '@emdad/ui/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@emdad/ui/ui/dialog'
import { Input } from '@emdad/ui/ui/input'
import { toneClasses, cn } from '@emdad/ui'

export type OmsScanResult = { ok: boolean; message: string }

function playSuccessChime() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const tone = () => {
      const now = ctx.currentTime
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0.15, now)
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25)
      const a = ctx.createOscillator()
      a.type = 'sine'
      a.frequency.setValueAtTime(784, now)
      a.connect(gain)
      a.start(now)
      a.stop(now + 0.1)
      const b = ctx.createOscillator()
      b.type = 'sine'
      b.frequency.setValueAtTime(1046.5, now + 0.1)
      b.connect(gain)
      b.start(now + 0.1)
      b.stop(now + 0.25)
      gain.connect(ctx.destination)
    }
    if (ctx.state === 'suspended') void ctx.resume().then(tone).catch(() => undefined)
    else tone()
  } catch {
    /* ignore */
  }
}

const FORMATS = [
  Html5QrcodeSupportedFormats.QR_CODE,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.ITF,
]

type Props = {
  open: boolean
  onClose: () => void
  onScan: (text: string) => void | Promise<OmsScanResult | void>
  isArabic: boolean
  /** Stay open after each scan so the next waybill can be scanned immediately. */
  keepOpen?: boolean
  title?: string
  hint?: string
  submitLabel?: string
}

/** Camera / barcode-gun scan dialog. Same scanning behaviour as the classic modal, new UI. */
export function OmsScanDialog({ open, onClose, onScan, isArabic, keepOpen = false, title, hint, submitLabel }: Props) {
  const hostId = useId().replace(/:/g, '_') + '_order_scan_host'
  const qrRef = useRef<Html5Qrcode | null>(null)
  const onScanRef = useRef(onScan)
  const keepOpenRef = useRef(keepOpen)
  const busyRef = useRef(false)
  const cooldownRef = useRef<{ code: string; until: number } | null>(null)
  const startRef = useRef<(f: 'environment' | 'user') => Promise<void>>(async () => undefined)
  onScanRef.current = onScan
  keepOpenRef.current = keepOpen

  const [cameraActive, setCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [facing, setFacing] = useState<'environment' | 'user'>('environment')
  const [manual, setManual] = useState('')
  const [detected, setDetected] = useState<string | null>(null)
  const [result, setResult] = useState<OmsScanResult | null>(null)
  const [accepted, setAccepted] = useState(0)

  const stop = useCallback(async () => {
    const inst = qrRef.current
    if (!inst) return
    try {
      if (inst.isScanning) await inst.stop()
    } catch {
      /* ignore */
    }
    try {
      inst.clear()
    } catch {
      /* ignore */
    }
    qrRef.current = null
    setCameraActive(false)
  }, [])

  const finish = useCallback(
    (rawText: string) => {
      let clean = rawText.trim()
      if (!clean || busyRef.current) return
      try {
        if (clean.startsWith('http://') || clean.startsWith('https://')) {
          const segs = new URL(clean).pathname.split('/').filter(Boolean)
          if (segs.length) clean = decodeURIComponent(segs[segs.length - 1] ?? clean)
        }
      } catch {
        /* ignore */
      }
      const cooled = cooldownRef.current
      if (cooled && cooled.code === clean && cooled.until > Date.now()) return
      busyRef.current = true
      setDetected(clean)
      void stop()
      void (async () => {
        try {
          const r = await onScanRef.current(clean)
          if (!keepOpenRef.current) {
            playSuccessChime()
            setTimeout(onClose, 400)
            return
          }
          const outcome = r && typeof r === 'object' ? r : { ok: true, message: clean }
          setResult(outcome)
          if (outcome.ok) {
            playSuccessChime()
            setAccepted((c) => c + 1)
          }
          cooldownRef.current = { code: clean, until: Date.now() + 8000 }
          setDetected(null)
          busyRef.current = false
          await startRef.current(facing)
        } catch (error) {
          if (!keepOpenRef.current) {
            onClose()
            return
          }
          setResult({ ok: false, message: error instanceof Error ? error.message : clean })
          setDetected(null)
          busyRef.current = false
          await startRef.current(facing)
        } finally {
          setManual('')
        }
      })()
    },
    [onClose, stop, facing],
  )

  const start = useCallback(
    async (cam: 'environment' | 'user') => {
      setCameraError(null)
      await stop()
      await new Promise((r) => setTimeout(r, 150))
      if (!document.getElementById(hostId)) return
      const inst = new Html5Qrcode(hostId, { verbose: false, formatsToSupport: FORMATS, useBarCodeDetectorIfSupported: true })
      qrRef.current = inst
      const qrbox = (w: number, h: number) => {
        const edge = Math.max(220, Math.floor(Math.min(w, h) * 0.75))
        return { width: edge, height: edge }
      }
      try {
        await inst.start({ facingMode: cam }, { fps: 10, qrbox, aspectRatio: 1.0 }, (text) => finish(text), () => undefined)
        setCameraActive(true)
      } catch (err: unknown) {
        setCameraError(
          err instanceof Error
            ? err.message
            : typeof err === 'string'
              ? err
              : isArabic
                ? 'تعذر الوصول إلى الكاميرا. يرجى التأكد من صلاحيات المتصفح.'
                : 'Could not access the camera. Check browser permissions.',
        )
        setCameraActive(false)
      }
    },
    [hostId, isArabic, finish, stop],
  )
  startRef.current = start

  useEffect(() => {
    if (open) {
      setDetected(null)
      setManual('')
      setCameraError(null)
      setResult(null)
      setAccepted(0)
      busyRef.current = false
      cooldownRef.current = null
      void start(facing)
    } else {
      void stop()
    }
    return () => {
      void stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const flip = () => {
    const next = facing === 'environment' ? 'user' : 'environment'
    setFacing(next)
    if (cameraActive) void start(next)
  }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (manual.trim()) finish(manual)
  }
  const close = () => {
    void stop()
    onClose()
  }
  const t = (en: string, ar: string) => (isArabic ? ar : en)

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title ?? t('Search order by scan (QR / barcode)', 'بحث عن طلب عبر المسح (QR / باركود)')}</DialogTitle>
          <DialogDescription>
            {hint ?? t('Point the camera at the waybill QR code or barcode to filter and locate the order.', 'وجّه الكاميرا نحو QR أو الباركود على بوليصة الشحن لتصفية الطلب مباشرة.')}
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div
            role="status"
            className={cn('rounded-lg border px-3 py-2 text-sm font-medium', toneClasses[result.ok ? 'success' : 'danger'].bg, toneClasses[result.ok ? 'success' : 'danger'].border, toneClasses[result.ok ? 'success' : 'danger'].text)}
          >
            {result.message}
          </div>
        ) : null}

        <div className="relative overflow-hidden rounded-xl border bg-black">
          <div id={hostId} className="flex min-h-64 w-full items-center justify-center text-white" />
          <div className="absolute end-2 top-2 z-10 flex items-center gap-1.5">
            <Button type="button" size="icon" variant="secondary" aria-label={t('Flip camera', 'تبديل الكاميرا')} onClick={flip}>
              <SwitchCamera aria-hidden />
            </Button>
            {!cameraActive ? (
              <Button type="button" size="icon" aria-label={t('Restart camera', 'إعادة تشغيل الكاميرا')} onClick={() => void start(facing)}>
                <Play aria-hidden />
              </Button>
            ) : null}
          </div>
          {detected ? (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-1 bg-black/80 text-white">
              <CheckCircle2 className="size-9 text-emerald-300" aria-hidden />
              <span className="font-mono text-sm font-semibold">{detected}</span>
              <span className="text-sm text-white/80">{keepOpen ? t('Code detected — recording…', 'تم التقاط الرمز — جاري التسجيل…') : t('Code detected — filtering…', 'تم التقاط الرمز — جاري التصفية…')}</span>
            </div>
          ) : null}
          {cameraError ? (
            <div className="space-y-3 p-6 text-center text-white">
              <VideoOff className="mx-auto size-7" aria-hidden />
              <p className="text-sm">{cameraError}</p>
              <Button type="button" size="sm" variant="secondary" onClick={() => void start(facing)}>
                {t('Retry camera', 'إعادة المحاولة')}
              </Button>
            </div>
          ) : null}
        </div>

        <form onSubmit={submit} className="flex gap-2">
          <div className="relative flex-1">
            <Barcode className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground" aria-hidden />
            <Input
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              className="ps-9"
              aria-label={t('Order number or scanner input', 'رقم الطلب أو إدخال القارئ')}
              placeholder={t('Or enter order # / use a barcode scanner…', 'أو أدخل رقم الطلب / استخدم قارئ الباركود…')}
            />
          </div>
          <Button type="submit" disabled={!manual.trim()}>
            {submitLabel ?? t('Search', 'بحث')}
          </Button>
        </form>

        <DialogFooter className="items-center sm:justify-between">
          <span className="text-sm text-muted-foreground">
            {accepted > 0 ? t(`${accepted} recorded`, `${accepted} تم تسجيلها`) : t('Waybill fast scan', 'مسح سريع لبوالص الشحن')}
          </span>
          <Button type="button" variant="outline" onClick={close}>
            {keepOpen ? t('Done', 'تم') : t('Cancel', 'إلغاء')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
