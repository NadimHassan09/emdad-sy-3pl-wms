import type { PickLineStatus } from '../../pages/tasks/pick/pick-types';
import type { PackLineStatus, PackScanStep } from '../../pages/tasks/pack/pack-types';
import type { DispatchReadiness, DispatchScanStep } from '../../pages/tasks/dispatch/dispatch-types';
import type { PutawayLineStatus } from '../../pages/tasks/putaway/putaway-types';
import type { ReceivingLineStatus } from '../../pages/tasks/receiving/receiving-types';
import type { PickScanStep } from '../../pages/tasks/pick/pick-types';
import type { LocalizedMessage } from '../ui-i18n';

export type TFn = (message: LocalizedMessage) => string;

export function localizedTaskTypeTitle(taskType: string, t: TFn): string {
  const m: Record<string, LocalizedMessage> = {
    receiving: ['Receiving', 'استلام'],
    qc: ['QC', 'فحص جودة'],
    putaway: ['Putaway', 'تخزين'],
    putaway_quarantine: ['Quarantine putaway', 'تخزين حجر'],
    pick: ['Pick', 'التقاط'],
    pack: ['Pack', 'تغليف'],
    dispatch: ['Dispatch', 'إرسال'],
    routing: ['Routing', 'توجيه'],
  };
  const msg = m[taskType];
  if (msg) return t(msg);
  return taskType
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function localizedPickLineStatus(status: PickLineStatus, t: TFn): string {
  const m: Record<PickLineStatus, LocalizedMessage> = {
    pending: ['Pending', 'قيد الانتظار'],
    scanning: ['At bin', 'عند Bin'],
    ready: ['Confirm qty', 'تأكيد الكمية'],
    complete: ['Complete', 'مكتمل'],
    short: ['Short', 'نقص'],
  };
  return t(m[status]);
}

export function localizedPickStatusFilterOptions(t: TFn): Array<{ value: PickLineStatus | ''; label: string }> {
  return [
    { value: '', label: t(['All statuses', 'كل الحالات']) },
    { value: 'pending', label: localizedPickLineStatus('pending', t) },
    { value: 'scanning', label: localizedPickLineStatus('scanning', t) },
    { value: 'ready', label: localizedPickLineStatus('ready', t) },
    { value: 'complete', label: localizedPickLineStatus('complete', t) },
    { value: 'short', label: localizedPickLineStatus('short', t) },
  ];
}

export function localizedPickScanStep(step: PickScanStep, t: TFn): string {
  const m: Record<PickScanStep, LocalizedMessage> = {
    location: ['Scan source bin', 'مسح Bin المصدر'],
    product: ['Scan product Barcode', 'مسح Barcode المنتج'],
    quantity: ['Confirm quantity', 'تأكيد الكمية'],
  };
  return t(m[step] ?? ['Scan', 'مسح']);
}

export function localizedPutawayLineStatus(status: PutawayLineStatus, t: TFn): string {
  const m: Record<PutawayLineStatus, LocalizedMessage> = {
    pending: ['Pending', 'قيد الانتظار'],
    scanning: ['In progress', 'قيد التنفيذ'],
    ready: ['Ready', 'جاهز'],
    complete: ['Complete', 'مكتمل'],
  };
  return t(m[status]);
}

export function localizedPutawayStatusFilterOptions(t: TFn): Array<{ value: PutawayLineStatus | ''; label: string }> {
  return [
    { value: '', label: t(['All statuses', 'كل الحالات']) },
    { value: 'pending', label: localizedPutawayLineStatus('pending', t) },
    { value: 'scanning', label: localizedPutawayLineStatus('scanning', t) },
    { value: 'ready', label: localizedPutawayLineStatus('ready', t) },
    { value: 'complete', label: localizedPutawayLineStatus('complete', t) },
  ];
}

export function localizedPutawayScanStep(step: 'source' | 'destination' | 'product', t: TFn): string {
  const m: Record<string, LocalizedMessage> = {
    source: ['Scan source (staging) location', 'مسح موقع المصدر (تجهيز)'],
    destination: ['Scan destination bin', 'مسح Bin الوجهة'],
    product: ['Scan product Barcode', 'مسح Barcode المنتج'],
  };
  return t(m[step]);
}

export function localizedReceivingStatusFilterOptions(
  t: TFn,
): Array<{ value: ReceivingLineStatus | ''; label: string }> {
  return [
    { value: '', label: t(['All statuses', 'كل الحالات']) },
    { value: 'pending', label: localizedReceivingLineStatus('pending', t) },
    { value: 'partial', label: localizedReceivingLineStatus('partial', t) },
    { value: 'complete', label: localizedReceivingLineStatus('complete', t) },
    { value: 'shortage', label: localizedReceivingLineStatus('shortage', t) },
    { value: 'overage', label: localizedReceivingLineStatus('overage', t) },
    { value: 'damaged', label: localizedReceivingLineStatus('damaged', t) },
  ];
}

export function localizedReceivingLineStatus(status: ReceivingLineStatus, t: TFn): string {
  const m: Record<ReceivingLineStatus, LocalizedMessage> = {
    pending: ['Pending', 'قيد الانتظار'],
    partial: ['In progress', 'قيد التنفيذ'],
    complete: ['Complete', 'مكتمل'],
    shortage: ['Short', 'نقص'],
    overage: ['Overage', 'زيادة'],
    damaged: ['Damage noted', 'تلف مسجّل'],
  };
  return t(m[status]);
}

export function localizedPackLineStatus(status: PackLineStatus, t: TFn): string {
  const m: Record<PackLineStatus, LocalizedMessage> = {
    pending: ['Pending', 'قيد الانتظار'],
    verifying: ['Verifying', 'تحقق'],
    packing: ['Packing', 'تغليف'],
    complete: ['Complete', 'مكتمل'],
    short: ['Short', 'نقص'],
    overpack: ['Overpack', 'زيادة تغليف'],
  };
  return t(m[status]);
}

export function localizedPackScanStep(step: PackScanStep, t: TFn): string {
  const m: Record<PackScanStep, LocalizedMessage> = {
    product: ['Scan product', 'مسح المنتج'],
    package: ['Scan package', 'مسح الطرد'],
  };
  return t(m[step]);
}

export function localizedPackageTypeOptions(t: TFn): Array<{ value: string; label: string }> {
  return [
    { value: 'box', label: t(['Box', 'صندوق']) },
    { value: 'carton', label: t(['Carton', 'كرتون']) },
    { value: 'pallet', label: t(['Pallet', 'طبلية']) },
    { value: 'envelope', label: t(['Envelope', 'ظرف']) },
    { value: 'other', label: t(['Other', 'أخرى']) },
  ];
}

export function localizedDispatchReadiness(r: DispatchReadiness, t: TFn): string {
  const m: Record<DispatchReadiness, LocalizedMessage> = {
    awaiting: ['Awaiting dispatch', 'بانتظار الإرسال'],
    partial: ['Partially ready', 'جاهز جزئياً'],
    ready: ['Ready to dispatch', 'جاهز للإرسال'],
    blocked: ['Blocked', 'محظور'],
  };
  return t(m[r]);
}

export function localizedDispatchScanStep(step: DispatchScanStep, t: TFn): string {
  const m: Record<DispatchScanStep, LocalizedMessage> = {
    source: ['Scan packing area (source)', 'مسح منطقة التغليف (مصدر)'],
    destination: ['Scan dispatch dock (destination)', 'مسح رصيف الإرسال (وجهة)'],
    package: ['Scan package label', 'مسح ملصق الطرد'],
  };
  return t(m[step]);
}

export function dataTablePaginationLabels(t: TFn) {
  return {
    rowsSuffix: t(['rows', 'صفوف']),
    resultsSuffix: t(['results', 'نتيجة']),
    ofWord: t(['of', 'من']),
    previous: t(['Previous', 'السابق']),
    next: t(['Next', 'التالي']),
    rowsPerPageAria: t(['Rows per page', 'عدد الصفوف لكل صفحة']),
  };
}

/** Shared task-line filter search placeholder (SKU / Barcode / Lot stay English). */
export function localizedTaskLineSearchPlaceholder(t: TFn): string {
  return t(['SKU, product name, barcode, or lot', 'SKU أو اسم المنتج أو Barcode أو Lot']);
}

export function localizedDispatchLineStatusFilterOptions(
  t: TFn,
): Array<{ value: '' | 'pending' | 'complete'; label: string }> {
  return [
    { value: '', label: t(['All statuses', 'كل الحالات']) },
    { value: 'pending', label: t(['Pending', 'قيد الانتظار']) },
    { value: 'complete', label: t(['Verified', 'مُحقَّق']) },
  ];
}

export function localizedDispatchSourceLocationHint(requiresPacking: boolean, t: TFn): string {
  return requiresPacking
    ? t([
        'Selected by the system from the pack task (or pick drop-off if no pack station was recorded).',
        'يُختار تلقائياً من مهمة التغليف (أو نقطة تسليم التقاط إن لم يُسجَّل موقع تغليف).',
      ])
    : t([
        'Selected by the system from the pick task drop-off location.',
        'يُختار تلقائياً من موقع تسليم مهمة التقاط.',
      ]);
}

export function localizedDispatchDestinationLocationHint(t: TFn): string {
  return t([
    'Selected by the system from the dispatch dock queue (round-robin across shipping docks).',
    'يُختار تلقائياً من طابور رصيف الإرسال (توزيع دائري على أرصفة الشحن).',
  ]);
}
