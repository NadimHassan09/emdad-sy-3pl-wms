import { useCallback, useRef, useState } from 'react'
import { CloudUpload } from 'lucide-react'
import { useUiPreferences } from '@emdad/core'
import { Alert, AlertDescription, AlertTitle } from '@emdad/ui/ui/alert'
import { Button } from '@emdad/ui/ui/button'
import { BackupsApi, type BackupUploadResult } from '@/api/backups'
import { formatBackupBytes } from '@/lib/backup-display'

type Props = {
  onSuccess?: (result: BackupUploadResult) => void
}

type UploadState =
  | { phase: 'idle' }
  | { phase: 'uploading' | 'processing'; percent: number; fileName: string }
  | { phase: 'success'; result: BackupUploadResult; fileName: string }
  | { phase: 'error'; message: string; fileName?: string }

export function BackupUploadDropzone({ onSuccess }: Props) {
  const { isArabic } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [state, setState] = useState<UploadState>({ phase: 'idle' })

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.name.toLowerCase().endsWith('.dump')) {
        setState({
          phase: 'error',
          message: t('Only PostgreSQL .dump files are accepted.', 'يُقبل فقط ملفات .dump من PostgreSQL.'),
          fileName: file.name,
        })
        return
      }

      setState({ phase: 'uploading', percent: 0, fileName: file.name })

      try {
        const result = await BackupsApi.upload(file, (percent, phase) => {
          setState({ phase, percent, fileName: file.name })
        })
        setState({ phase: 'success', result, fileName: file.name })
        onSuccess?.(result)
      } catch (err) {
        setState({
          phase: 'error',
          message: err instanceof Error ? err.message : t('Upload failed', 'فشل الرفع'),
          fileName: file.name,
        })
      }
    },
    [onSuccess, isArabic],
  )

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      const file = e.dataTransfer.files?.[0]
      if (file) void handleFile(file)
    },
    [handleFile],
  )

  const busy = state.phase === 'uploading' || state.phase === 'processing'

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={[
          'rounded-xl border-2 border-dashed p-8 text-center transition',
          dragOver ? 'border-primary bg-tone-success-bg/40' : 'border-border bg-muted/30',
          busy ? 'pointer-events-none opacity-70' : 'cursor-pointer hover:border-primary/60',
        ].join(' ')}
        onClick={() => !busy && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click()
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".dump"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void handleFile(file)
            e.target.value = ''
          }}
        />
        <CloudUpload className="mx-auto mb-3 size-10 text-primary" aria-hidden />
        <p className="text-sm font-medium">{t('Drag and drop a backup file here', 'اسحب ملف النسخة وأفلته هنا')}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('or click to browse · .dump only', 'أو انقر للاختيار · .dump فقط')}
        </p>
      </div>

      {(state.phase === 'uploading' || state.phase === 'processing') && (
        <div className="space-y-2 rounded-xl border p-4">
          <div className="flex justify-between text-sm">
            <span className="font-medium">{state.fileName}</span>
            <span className="text-muted-foreground">
              {state.phase === 'processing' ? t('Validating…', 'جارٍ التحقق…') : `${state.percent}%`}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${state.percent}%` }} />
          </div>
        </div>
      )}

      {state.phase === 'success' && (
        <Alert>
          <AlertTitle>{t('Upload validated successfully', 'تم التحقق من الرفع بنجاح')}</AlertTitle>
          <AlertDescription>
            <dl className="mt-2 grid gap-2 font-mono text-xs sm:grid-cols-2">
              <div>
                <dt>{t('Job ID', 'معرّف المهمة')}</dt>
                <dd className="break-all">{state.result.jobId}</dd>
              </div>
              <div>
                <dt>{t('Size', 'الحجم')}</dt>
                <dd>{formatBackupBytes(state.result.sizeBytes)}</dd>
              </div>
            </dl>
          </AlertDescription>
        </Alert>
      )}

      {state.phase === 'error' && (
        <Alert variant="destructive">
          <AlertTitle>{t('Validation failed', 'فشل التحقق')}</AlertTitle>
          <AlertDescription>
            {state.fileName ? <p className="text-xs opacity-80">{state.fileName}</p> : null}
            <p className="mt-2">{state.message}</p>
            <Button className="mt-3" size="sm" variant="secondary" onClick={() => setState({ phase: 'idle' })}>
              {t('Try again', 'حاول مجدداً')}
            </Button>
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
