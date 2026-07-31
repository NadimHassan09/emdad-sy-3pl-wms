import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import {
  DocumentLang,
  DocumentMeta,
  DocumentReferenceType,
  DocumentsApi,
} from '../../api/documents';
import { WorkflowsApi } from '../../api/workflows';
import { Button } from '../Button';
import { FilterPanel } from '../FilterPanel';
import { useToast } from '../ToastProvider';

interface Props {
  referenceType: DocumentReferenceType;
  referenceId: string;
  companyIdOverride?: string;
}

function useIsArabic(): boolean {
  return (
    typeof window !== 'undefined' &&
    (window.localStorage.getItem('wms-ui-language') === 'AR' ||
      document.documentElement.dir === 'rtl')
  );
}

const LANGS: DocumentLang[] = ['en', 'ar'];

function isCompletedTaskStatus(status: string): boolean {
  return ['completed', 'done', 'shipped', 'approved', 'closed'].includes(status);
}

type DocRow = {
  type: DocumentMeta['type'];
  taskId: string;
  number: string;
  byLang: Map<DocumentLang, DocumentMeta>;
};

export function OrderDocumentsCard({ referenceType, referenceId, companyIdOverride }: Props) {
  const isArabic = useIsArabic();
  const toast = useToast();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);

  const t = (en: string, ar: string) => (isArabic ? ar : en);
  const queryKey = ['documents', referenceType, referenceId];
  const docType: DocumentMeta['type'] =
    referenceType === 'inbound_order' ? 'grn' : 'delivery_note';
  const sourceTaskType = referenceType === 'inbound_order' ? 'receiving' : 'dispatch';

  const docsQuery = useQuery({
    queryKey,
    queryFn: () => DocumentsApi.list(referenceType, referenceId),
    enabled: !!referenceId,
  });

  const timelineQuery = useQuery({
    queryKey: ['workflow-timeline', referenceType, referenceId, companyIdOverride ?? ''],
    queryFn: () => WorkflowsApi.getTimeline(referenceType, referenceId, companyIdOverride),
    enabled: !!referenceId,
  });

  const generate = useMutation({
    mutationFn: ({ type, taskId, lang }: { type: DocumentMeta['type']; taskId: string; lang: DocumentLang }) =>
      type === 'grn' ? DocumentsApi.generateGrn(taskId, lang) : DocumentsApi.generateDn(taskId, lang),
  });

  const sourceTask = useMemo(() => {
    const tasks = timelineQuery.data?.tasks ?? [];
    const completed = tasks.filter(
      (task) => task.taskType === sourceTaskType && isCompletedTaskStatus(task.status),
    );
    return completed.sort((a, b) => {
      const aMs = a.completedAt ? new Date(a.completedAt).getTime() : 0;
      const bMs = b.completedAt ? new Date(b.completedAt).getTime() : 0;
      return bMs - aMs;
    })[0];
  }, [timelineQuery.data?.tasks, sourceTaskType]);

  const rows = useMemo(() => {
    const groups = new Map<string, DocRow>();
    for (const d of docsQuery.data ?? []) {
      if (!d.taskId) continue;
      const key = `${d.type}:${d.taskId}`;
      const g = groups.get(key) ?? {
        type: d.type,
        taskId: d.taskId,
        number: d.documentNumber,
        byLang: new Map<DocumentLang, DocumentMeta>(),
      };
      g.byLang.set(d.language, d);
      if (d.language === 'en') g.number = d.documentNumber;
      groups.set(key, g);
    }

    const list = [...groups.values()];

    if (sourceTask) {
      const key = `${docType}:${sourceTask.id}`;
      if (!groups.has(key)) {
        list.unshift({
          type: docType,
          taskId: sourceTask.id,
          number: '',
          byLang: new Map(),
        });
      }
    }

    return list;
  }, [docsQuery.data, docType, sourceTask]);

  const typeLabel = (type: DocumentMeta['type']) =>
    type === 'grn'
      ? t('Goods Receipt Note (GRN)', 'سند استلام بضاعة (GRN)')
      : t('Delivery Note (DN)', 'سند تسليم (DN)');

  const langLabel = (lang: DocumentLang) =>
    lang === 'en' ? t('English', 'إنجليزي') : t('Arabic', 'عربي');

  const handleAction = async (row: DocRow, lang: DocumentLang) => {
    const busyKey = `${row.type}:${row.taskId}:${lang}`;
    setBusy(busyKey);
    try {
      // Always re-render via POST so explicit clicks pick up the latest template
      // (replaces any PDF generated before a layout change).
      const created = await generate.mutateAsync({ type: row.type, taskId: row.taskId, lang });
      await qc.invalidateQueries({ queryKey });
      if (created?.id) await DocumentsApi.openInNewTab(created.id);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const pendingHint =
    referenceType === 'inbound_order'
      ? t(
          'Complete the receiving task to generate a Goods Receipt Note (GRN).',
          'أكمل مهمة الاستلام لإنشاء سند استلام البضاعة (GRN).',
        )
      : t(
          'Complete the dispatch task to generate a Delivery Note (DN).',
          'أكمل مهمة التسليم لإنشاء سند التسليم (DN).',
        );

  const isLoading = docsQuery.isLoading || timelineQuery.isLoading;

  return (
    <FilterPanel title={t('Documents', 'المستندات')} variant="content">
      {isLoading ? (
        <p className="text-sm text-text-muted">{t('Loading…', 'جارٍ التحميل…')}</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-text-muted">{pendingHint}</p>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <div
              key={`${row.type}:${row.taskId}`}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface-card px-4 py-3"
            >
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
                  <div className="text-sm font-semibold text-text-strong">{typeLabel(row.type)}</div>
                  <div className="font-mono text-xs text-text-muted">
                    {row.number || t('Not generated yet', 'لم يُنشأ بعد')}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {LANGS.map((lang) => {
                  const existing = row.byLang.get(lang);
                  const busyKey = `${row.type}:${row.taskId}:${lang}`;
                  return (
                    <Button
                      key={lang}
                      size="sm"
                      variant={existing ? 'secondary' : 'primary'}
                      loading={busy === busyKey}
                      onClick={() => handleAction(row, lang)}
                    >
                      {existing
                        ? `${t('Open PDF', 'فتح PDF')} · ${langLabel(lang)}`
                        : `${t('Create PDF', 'إنشاء PDF')} · ${langLabel(lang)}`}
                    </Button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </FilterPanel>
  );
}
