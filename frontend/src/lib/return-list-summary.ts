import type { ReturnItemDisposition, ReturnOrderListSummary } from '../api/returns';
import { dispositionLabel } from './return-labels';

export function formatReturnListDisposition(
  summary: ReturnOrderListSummary | undefined,
  isArabic: boolean,
): string {
  if (!summary?.dispositionSummary) return '—';
  if (summary.dispositionSummary === 'mixed') {
    return isArabic ? 'متعدد' : 'Mixed';
  }
  return dispositionLabel(summary.dispositionSummary as ReturnItemDisposition, isArabic);
}

export function formatReturnListQuantities(summary: ReturnOrderListSummary | undefined): string {
  if (!summary) return '—';
  const exp = Number(summary.totalExpected);
  const rec = Number(summary.totalReceived);
  if (!Number.isFinite(exp)) return '—';
  if (rec > 0 && rec !== exp) {
    return `${rec.toLocaleString()} / ${exp.toLocaleString()}`;
  }
  return exp.toLocaleString();
}
