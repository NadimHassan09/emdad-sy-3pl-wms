import { useCallback, useRef, useState } from 'react';

import { BackupsApi, type BackupUploadResult } from '../../api/backups';
import { formatBackupBytes } from '../../lib/backup-display';
import { useWmsTranslation } from '../../lib/ui-i18n';
import { Button } from '../Button';

type Props = {
  onSuccess?: (result: BackupUploadResult) => void;
};

type UploadState =
  | { phase: 'idle' }
  | { phase: 'uploading' | 'processing'; percent: number; fileName: string }
  | { phase: 'success'; result: BackupUploadResult; fileName: string }
  | { phase: 'error'; message: string; fileName?: string };

export function BackupUploadDropzone({ onSuccess }: Props) {
  const { t } = useWmsTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [state, setState] = useState<UploadState>({ phase: 'idle' });

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.name.toLowerCase().endsWith('.dump')) {
        setState({
          phase: 'error',
          message: t([
            'Only PostgreSQL .dump files are accepted.',
            'يُقبل فقط ملفات .dump من PostgreSQL.',
          ]),
          fileName: file.name,
        });
        return;
      }

      setState({ phase: 'uploading', percent: 0, fileName: file.name });

      try {
        const result = await BackupsApi.upload(file, (percent, phase) => {
          setState({ phase, percent, fileName: file.name });
        });
        setState({ phase: 'success', result, fileName: file.name });
        onSuccess?.(result);
      } catch (err) {
        setState({
          phase: 'error',
          message: err instanceof Error ? err.message : t(['Upload failed', 'فشل الرفع']),
          fileName: file.name,
        });
      }
    },
    [onSuccess, t],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) void handleFile(file);
    },
    [handleFile],
  );

  const busy = state.phase === 'uploading' || state.phase === 'processing';

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={[
          'rounded-xl border-2 border-dashed p-8 text-center transition',
          dragOver ? 'border-emerald-500 bg-emerald-50/50' : 'border-slate-200 bg-slate-50/40',
          busy ? 'pointer-events-none opacity-70' : 'cursor-pointer hover:border-emerald-400',
        ].join(' ')}
        onClick={() => !busy && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".dump"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
            e.target.value = '';
          }}
        />
        <i className="fa-solid fa-cloud-arrow-up mb-3 text-3xl text-emerald-600" aria-hidden />
        <p className="text-sm font-medium text-slate-800">
          {t(['Drag and drop a backup file here', 'اسحب ملف النسخة الاحتياطية وأفلته هنا'])}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          {t([
            'or click to browse · .dump only · max 10 GB',
            'أو انقر للاختيار · .dump فقط · حد أقصى 10 GB',
          ])}
        </p>
      </div>

      {(state.phase === 'uploading' || state.phase === 'processing') && (
        <div className="space-y-2 rounded-xl border border-slate-100 bg-white p-4">
          <div className="flex justify-between text-sm">
            <span className="font-medium text-slate-700">{state.fileName}</span>
            <span className="text-slate-500">
              {state.phase === 'processing'
                ? t(['Validating…', 'جارٍ التحقق…'])
                : `${state.percent}%`}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${state.percent}%` }}
            />
          </div>
        </div>
      )}

      {state.phase === 'success' && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 text-sm text-emerald-900">
          <p className="font-semibold">
            {t(['Upload validated successfully', 'تم التحقق من الرفع بنجاح'])}
          </p>
          <dl className="mt-3 grid gap-2 font-mono text-xs sm:grid-cols-2">
            <div>
              <dt className="text-emerald-700">{t(['Job ID', 'معرّف المهمة'])}</dt>
              <dd className="break-all">{state.result.jobId}</dd>
            </div>
            <div>
              <dt className="text-emerald-700">{t(['Size', 'الحجم'])}</dt>
              <dd>{formatBackupBytes(state.result.sizeBytes)}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-emerald-700">SHA-256</dt>
              <dd className="break-all">{state.result.checksumSha256}</dd>
            </div>
          </dl>
        </div>
      )}

      {state.phase === 'error' && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
          <p className="font-semibold">{t(['Validation failed', 'فشل التحقق'])}</p>
          {state.fileName ? <p className="mt-1 text-xs opacity-80">{state.fileName}</p> : null}
          <p className="mt-2">{state.message}</p>
          <Button
            className="mt-3"
            size="sm"
            variant="secondary"
            onClick={() => setState({ phase: 'idle' })}
          >
            {t(['Try again', 'حاول مجدداً'])}
          </Button>
        </div>
      )}
    </div>
  );
}
