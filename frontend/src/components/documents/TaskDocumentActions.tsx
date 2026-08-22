import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import {
  DocumentLang,
  DocumentMeta,
  DocumentReferenceType,
  DocumentsApi,
} from '../../api/documents';
import { Button } from '../Button';
import { FilterPanel } from '../FilterPanel';
import { useToast } from '../ToastProvider';

interface Props {
  /** Source warehouse task id (receiving → GRN, dispatch → DN). */
  taskId: string;
  taskType: 'receiving' | 'dispatch';
  referenceType: DocumentReferenceType;
  referenceId: string;
}

function useIsArabic(): boolean {
  return (
    typeof window !== 'undefined' &&
    (window.localStorage.getItem('wms-ui-language') === 'AR' ||
      document.documentElement.dir === 'rtl')
  );
}

const LANGS: DocumentLang[] = ['en', 'ar'];

/**
 * Compact, task-scoped GRN / Delivery Note generator + downloader. Renders on the
 * completed receiving/dispatch task page so operators can produce or open the
 * immutable PDF for *this* task without leaving the task screen.
 */
export function TaskDocumentActions({ taskId, taskType, referenceType, referenceId }: Props) {
  const isArabic = useIsArabic();
  const toast = useToast();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);

  const t = (en: string, ar: string) => (isArabic ? ar : en);
  const docType: DocumentMeta['type'] = taskType === 'receiving' ? 'grn' : 'delivery_note';
  const queryKey = ['documents', referenceType, referenceId];

  const docsQuery = useQuery({
    queryKey,
    queryFn: () => DocumentsApi.list(referenceType, referenceId),
    enabled: !!referenceId,
  });

  const generate = useMutation({
    mutationFn: (lang: DocumentLang) =>
      docType === 'grn'
        ? DocumentsApi.generateGrn(taskId, lang)
        : DocumentsApi.generateDn(taskId, lang),
  });

  // Only documents produced from this exact task.
  const byLang = new Map<DocumentLang, DocumentMeta>();
  let documentNumber = '';
  for (const d of docsQuery.data ?? []) {
    if (d.type !== docType || d.taskId !== taskId) continue;
    byLang.set(d.language, d);
    if (d.language === 'en' || !documentNumber) documentNumber = d.documentNumber;
  }

  const title =
    docType === 'grn'
      ? t('Goods Receipt Note (GRN)', 'سند استلام بضاعة (GRN)')
      : t('Delivery Note (DN)', 'سند تسليم (DN)');

  const langLabel = (lang: DocumentLang) =>
    lang === 'en' ? t('English', 'إنجليزي') : t('Arabic', 'عربي');

  const handle = async (lang: DocumentLang) => {
    setBusy(lang);
    try {
      const created = await generate.mutateAsync(lang);
      await qc.invalidateQueries({ queryKey });
      if (created?.id) await DocumentsApi.openInNewTab(created.id);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <FilterPanel title={t('Document', 'المستند')} variant="content">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface-card px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-[#EAF6F0] text-[#0B5E3C]">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          </span>
          <div>
            <div className="text-sm font-semibold text-text-strong">{title}</div>
            <div className="font-mono text-xs text-text-muted">
              {documentNumber
                ? documentNumber
                : docsQuery.isLoading
                  ? t('Loading…', 'جارٍ التحميل…')
                  : t('Not generated yet', 'لم يُنشأ بعد')}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {LANGS.map((lang) => {
            const existing = byLang.get(lang);
            return (
              <Button
                key={lang}
                size="sm"
                variant={existing ? 'secondary' : 'primary'}
                loading={busy === lang}
                onClick={() => handle(lang)}
              >
                {existing
                  ? `${t('Open PDF', 'فتح PDF')} · ${langLabel(lang)}`
                  : `${t('Create PDF', 'إنشاء PDF')} · ${langLabel(lang)}`}
              </Button>
            );
          })}
        </div>
      </div>
      <p className="mt-2 text-xs text-text-muted">
        {docType === 'grn'
          ? t(
              'The GRN is an immutable copy of this receiving task. Once created it never changes.',
              'سند استلام البضاعة نسخة ثابتة لمهمة الاستلام هذه. بمجرد إنشائه لا يتغيّر.',
            )
          : t(
              'The Delivery Note is an immutable copy of this dispatch task. Once created it never changes.',
              'سند التسليم نسخة ثابتة لمهمة التسليم هذه. بمجرد إنشائه لا يتغيّر.',
            )}
      </p>
    </FilterPanel>
  );
}
